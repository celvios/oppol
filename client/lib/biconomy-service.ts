import { createWalletClient, custom, encodeFunctionData, parseAbi } from "viem";
import { bsc } from "viem/chains";
import { createSmartAccountClient } from "@biconomy/account";
import { PaymasterMode } from "@biconomy/paymaster";
import { ethers } from "ethers";

// Estimated gas for a batched UserOperation (Approve + USDC Transfer + buyShares + EntryPoint overhead)
const ESTIMATED_GAS_UNITS = 330_000n;
const USDC_DECIMALS = 18;

export class BiconomyService {

    /**
     * Fetches the real-time gas fee in USDC by:
     * 1. Getting current BSC gas price from the RPC node
     * 2. Getting current BNB/USD price from Binance public API
     * 3. Calculating: gas_units × gas_price_gwei × bnb_price_usd → USDC amount
     * 
     * Adds a 20% buffer on top to protect against price spikes between estimation and execution.
     */
    static async estimateGasFeeUSDC(): Promise<bigint> {
        try {
            const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://bsc-dataseed.binance.org/";
            const provider = new ethers.JsonRpcProvider(rpcUrl);

            // 1. Get live BSC gas price
            const feeData = await provider.getFeeData();
            const gasPriceWei = feeData.gasPrice ?? ethers.parseUnits("3", "gwei"); // Fallback: 3 Gwei

            // 2. Get live BNB/USD price from Binance public API (no key required)
            let bnbPriceUSD = 600; // Fallback price
            try {
                const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT");
                const json = await res.json();
                bnbPriceUSD = parseFloat(json.price);
            } catch (priceErr) {
                console.warn("[GasFee] Could not fetch BNB price from Binance. Using fallback $600.");
            }

            // 3. Calculate exact cost in USD
            // gas_cost_bnb = gas_units × gas_price_in_bnb
            // gas_price_in_bnb = gasPriceWei / 1e18
            const gasCostBNB = Number(ESTIMATED_GAS_UNITS) * Number(gasPriceWei) / 1e18;
            const gasCostUSD = gasCostBNB * bnbPriceUSD;

            // 4. Add 20% buffer to handle price movements between estimation & execution
            const gasCostWithBuffer = gasCostUSD * 1.20;

            console.log(
                `[GasFee] Gas Price: ${ethers.formatUnits(gasPriceWei, "gwei")} Gwei | ` +
                `BNB: $${bnbPriceUSD.toFixed(2)} | ` +
                `Estimated Cost: $${gasCostUSD.toFixed(4)} | ` +
                `Fee (with 20% buffer): $${gasCostWithBuffer.toFixed(4)} USDC`
            );

            // Convert to BigInt with 18 decimal places (USDC on BSC uses 18 decimals)
            const feeUSDC = ethers.parseUnits(gasCostWithBuffer.toFixed(18), USDC_DECIMALS);
            return feeUSDC;

        } catch (err) {
            console.error("[GasFee] Gas estimation failed. Using safe fallback of $0.20 USDC.", err);
            // Safe fallback: $0.20 USDC — covers most BSC gas scenarios
            return ethers.parseUnits("0.20", USDC_DECIMALS);
        }
    }

    private static async getSmartAccount(privyWallet: any) {
        const provider = await privyWallet.getEthereumProvider();
        const walletClient = createWalletClient({
            account: privyWallet.address as `0x${string}`,
            chain: bsc,
            transport: custom(provider)
        });

        const paymasterUrl = process.env.NEXT_PUBLIC_BICONOMY_PAYMASTER_URL || "";
        const bundlerUrl = process.env.NEXT_PUBLIC_BICONOMY_BUNDLER_URL || "";

        if (!paymasterUrl || !bundlerUrl) {
            throw new Error("Biconomy environment variables missing. Please set NEXT_PUBLIC_BICONOMY_PAYMASTER_URL and NEXT_PUBLIC_BICONOMY_BUNDLER_URL.");
        }

        const smartAccount = await createSmartAccountClient({
            signer: walletClient,
            biconomyPaymasterApiKey: paymasterUrl,
            bundlerUrl: bundlerUrl,
        });

        return smartAccount;
    }

    /**
     * Executes a gasless, batched trade for any user (MetaMask, email, Google).
     * Transaction Batch (single atomic UserOperation):
     * 1. Approve USDC for Market Contract (amount = costUSDC)
     * 2. Transfer dynamic gas fee (USDC) to Treasury to reimburse Biconomy spend
     * 3. buyShares() — the actual trade
     * 
     * feeUSDC is calculated dynamically by calling estimateGasFeeUSDC() before this.
     */
    static async executeBatchedTrade(
        privyWallet: any,
        marketAddress: string,
        usdcAddress: string,
        treasuryAddress: string,
        marketId: number,
        outcomeIndex: number,
        sharesToBuy: bigint,
        costUSDC: bigint,
        feeUSDC: bigint
    ): Promise<string> {
        console.log(`[Biconomy] Preparing gasless batch trade for Market ${marketId} | Fee: ${ethers.formatUnits(feeUSDC, USDC_DECIMALS)} USDC`);

        const smartAccount = await this.getSmartAccount(privyWallet);

        // 1. Approve Market Contract to spend USDC for shares
        const encodeApprove = encodeFunctionData({
            abi: parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]),
            functionName: "approve",
            args: [marketAddress as `0x${string}`, costUSDC]
        });

        const batch: { to: string; data: string }[] = [
            { to: usdcAddress, data: encodeApprove }
        ];

        // 2. Transfer exact USDC gas fee to Treasury (only if fee > 0)
        if (feeUSDC > 0n) {
            const encodeTransfer = encodeFunctionData({
                abi: parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]),
                functionName: "transfer",
                args: [treasuryAddress as `0x${string}`, feeUSDC]
            });
            batch.push({ to: usdcAddress, data: encodeTransfer });
        }

        // 3. Buy Shares
        const encodeBuy = encodeFunctionData({
            abi: parseAbi(["function buyShares(uint256 _marketId, uint256 _outcomeIndex, uint256 _sharesOut, uint256 _maxCost) returns (uint256)"]),
            functionName: "buyShares",
            args: [BigInt(marketId), BigInt(outcomeIndex), sharesToBuy, costUSDC]
        });
        batch.push({ to: marketAddress, data: encodeBuy });

        console.log(`[Biconomy] Building UserOperation with ${batch.length} batched transactions...`);

        // Build & Sponsor UserOperation (Biconomy pays BNB gas, treasury receives USDC reimbursement)
        const userOpResponse = await smartAccount.sendTransaction(batch, {
            paymasterServiceData: { mode: PaymasterMode.SPONSORED }
        });

        console.log(`[Biconomy] UserOperation dispatched! Hash: ${userOpResponse.userOpHash}`);

        const receipt = await userOpResponse.wait();
        console.log(`[Biconomy] On-chain confirmation: ${receipt.receipt.transactionHash}`);

        return receipt.receipt.transactionHash;
    }
}
