import { createWalletClient, custom, encodeFunctionData, parseAbi } from "viem";
import { bsc } from "viem/chains";
import { createSmartAccountClient } from "@biconomy/account";
import { PaymasterMode } from "@biconomy/paymaster";
import { ethers } from "ethers";

export class BiconomyService {
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
            throw new Error("Biconomy environment variables missing");
        }

        const smartAccount = await createSmartAccountClient({
            signer: walletClient,
            biconomyPaymasterApiKey: paymasterUrl, // Biconomy uses URL or API key depending on version; often URL contains the key
            bundlerUrl: bundlerUrl,
        });

        return smartAccount;
    }

    /**
     * Executes a gasless, batched trade for a Privy Smart Wallet user.
     * Transaction Batch:
     * 1. Approve USDC for Market Contract
     * 2. Transfer Gas Fee Equivalency (USDC) to Treasury
     * 3. Buy Shares
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
        console.log(`[Biconomy] Preparing gasless batch trade for Market ${marketId}...`);

        const smartAccount = await this.getSmartAccount(privyWallet);

        // 1. Approve Market Contract to spend USDC
        const encodeApprove = encodeFunctionData({
            abi: parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]),
            functionName: "approve",
            args: [marketAddress as `0x${string}`, costUSDC]
        });

        // 2. Transfer USDC Fee to Treasury 
        // We only add this transaction if the fee > 0
        const batch: { to: string; data: string }[] = [
            { to: usdcAddress, data: encodeApprove }
        ];

        if (feeUSDC > 0n) {
            const encodeTransfer = encodeFunctionData({
                abi: parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]),
                functionName: "transfer",
                args: [treasuryAddress as `0x${string}`, feeUSDC]
            });
            batch.push({ to: usdcAddress, data: encodeTransfer });
        }

        // 3. Buy Shares Call
        const encodeBuy = encodeFunctionData({
            abi: parseAbi(["function buyShares(uint256 _marketId, uint256 _outcomeIndex, uint256 _sharesOut, uint256 _maxCost) returns (uint256)"]),
            functionName: "buyShares",
            args: [BigInt(marketId), BigInt(outcomeIndex), sharesToBuy, costUSDC]
        });
        batch.push({ to: marketAddress, data: encodeBuy });

        console.log(`[Biconomy] Building UserOperation with ${batch.length} transactions...`);

        // Build & Sponsor UserOperation
        const userOpResponse = await smartAccount.sendTransaction(batch, {
            paymasterServiceData: { mode: PaymasterMode.SPONSORED }
        });

        console.log(`[Biconomy] UserOperation dispatched! Hash: ${userOpResponse.userOpHash}`);

        // Wait for Bundler to execute on-chain
        const receipt = await userOpResponse.wait();
        console.log(`[Biconomy] Execution receipt obtained: ${receipt.receipt.transactionHash}`);

        return receipt.receipt.transactionHash;
    }
}
