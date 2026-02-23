/**
 * PimlicoService — replaces BiconomyService.
 * Uses permissionless.js + Pimlico bundler/paymaster for ERC-4337 gasless trading on BSC.
 * 
 * Required .env.local:
 *   NEXT_PUBLIC_PIMLICO_API_KEY=your_pimlico_api_key
 *   NEXT_PUBLIC_RPC_URL=https://bsc-dataseed.binance.org/
 *   NEXT_PUBLIC_TREASURY_ADDRESS=0x...
 */

import {
    createPublicClient,
    createWalletClient,
    custom,
    encodeFunctionData,
    http,
    parseAbi,
    type Address,
} from "viem";
import { bsc } from "viem/chains";
import { ethers } from "ethers";
import { createSmartAccountClient } from "permissionless";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { entryPoint07Address } from "viem/account-abstraction";

// We no longer rely on a hardcoded array of gas units, the backend handles the base.
// const ESTIMATED_GAS_UNITS = BigInt(330000);
const USDC_DECIMALS = 18;

// BSC Mainnet chain ID
const BSC_CHAIN_ID = 56;

function getPimlicoUrl(): string {
    const apiKey = process.env.NEXT_PUBLIC_PIMLICO_API_KEY;
    if (!apiKey) throw new Error("NEXT_PUBLIC_PIMLICO_API_KEY is missing from .env.local");
    return `https://api.pimlico.io/v2/${BSC_CHAIN_ID}/rpc?apikey=${apiKey}`;
}

export class BiconomyService {

    /**
     * Fetches real-time gas fee in USDC from the backend Chainlink Oracle.
     */
    static async estimateGasFeeUSDC(): Promise<bigint> {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
            const response = await fetch(`${apiUrl}/api/gas/estimate`);
            const data = await response.json();

            if (data.success && data.feeUSDCWei) {
                console.log(`[GasFee] Oracle estimate: ${data.feeUSDC} USDC`);
                return BigInt(data.feeUSDCWei);
            }

            console.warn("[GasFee] Backend Oracle returned an error, falling back to $0.20 USDC.");
            return ethers.parseUnits("0.20", USDC_DECIMALS);

        } catch (err) {
            console.error("[GasFee] Estimation API call failed. Falling back to $0.20 USDC.", err);
            return ethers.parseUnits("0.20", USDC_DECIMALS);
        }
    }

    /**
     * Exposes the deterministic Smart Account Address for funding purposes.
     */
    static async getSmartAccountAddress(privyWallet: any): Promise<string> {
        const smartAccountClient = await this.getSmartAccountClient(privyWallet);
        return smartAccountClient.account.address;
    }

    /**
     * Derives the deterministic Smart Account address from just an EOA address.
     * Works for Reown/wagmi wallet users who are NOT Privy users.
     * Uses window.ethereum (the connected wallet's provider).
     */
    static async getSmartAccountAddressFromEOA(ownerAddress: string): Promise<string> {
        const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://bsc-dataseed.binance.org/";
        const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });

        const provider = (window as any).ethereum;
        if (!provider) throw new Error('No ethereum provider found');

        const walletClient = createWalletClient({
            account: ownerAddress as Address,
            chain: bsc,
            transport: custom(provider),
        });

        const smartAccount = await toSimpleSmartAccount({
            client: publicClient,
            owner: walletClient,
            entryPoint: { address: entryPoint07Address, version: "0.7" },
        });

        return smartAccount.address;
    }

    /**
     * Builds a Pimlico-backed Smart Account Client for the given Privy/external wallet.
     */
    private static async getSmartAccountClient(privyWallet: any) {
        const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://bsc-dataseed.binance.org/";
        const pimlicoUrl = getPimlicoUrl();

        // Public client for reading chain state
        const publicClient = createPublicClient({
            chain: bsc,
            transport: http(rpcUrl),
        });

        // Wallet client from Privy / MetaMask provider
        const ethereumProvider = await privyWallet.getEthereumProvider();
        const walletClient = createWalletClient({
            account: privyWallet.address as Address,
            chain: bsc,
            transport: custom(ethereumProvider),
        });

        // Pimlico bundler + paymaster client
        const pimlicoClient = createPimlicoClient({
            transport: http(pimlicoUrl),
            entryPoint: {
                address: entryPoint07Address,
                version: "0.7",
            },
        });

        // ERC-4337 Simple Smart Account
        const smartAccount = await toSimpleSmartAccount({
            client: publicClient,
            owner: walletClient,
            entryPoint: {
                address: entryPoint07Address,
                version: "0.7",
            },
        });

        // Combine account + bundler + sponsored paymaster
        const smartAccountClient = createSmartAccountClient({
            account: smartAccount,
            chain: bsc,
            bundlerTransport: http(pimlicoUrl),
            paymaster: pimlicoClient,
            userOperation: {
                estimateFeesPerGas: async () => {
                    return (await pimlicoClient.getUserOperationGasPrice()).fast;
                },
            },
        });

        return smartAccountClient;
    }

    /**
     * Executes a gasless, batched trade for any user.
     * Atomic UserOperation batch:
     *   1. approve(marketContract, costUSDC)
     *   2. transfer(treasury, feeUSDC)
     *   3. buyShares(marketId, outcome, shares, maxCost)
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
        console.log(
            `[Pimlico] Preparing gasless trade | Market: ${marketId} | ` +
            `Cost: ${ethers.formatUnits(costUSDC, USDC_DECIMALS)} USDC | ` +
            `Fee: ${ethers.formatUnits(feeUSDC, USDC_DECIMALS)} USDC`
        );

        const smartAccountClient = await this.getSmartAccountClient(privyWallet);

        const approveData = encodeFunctionData({
            abi: parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]),
            functionName: "approve",
            args: [marketAddress as Address, costUSDC],
        });

        const calls: { to: Address; data: `0x${string}` }[] = [
            { to: usdcAddress as Address, data: approveData },
        ];

        if (feeUSDC > BigInt(0)) {
            const transferData = encodeFunctionData({
                abi: parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]),
                functionName: "transfer",
                args: [treasuryAddress as Address, feeUSDC],
            });
            calls.push({ to: usdcAddress as Address, data: transferData });
        }

        const buyData = encodeFunctionData({
            abi: parseAbi(["function buyShares(uint256 _marketId, uint256 _outcomeIndex, uint256 _sharesOut, uint256 _maxCost) returns (uint256)"]),
            functionName: "buyShares",
            args: [BigInt(marketId), BigInt(outcomeIndex), sharesToBuy, costUSDC],
        });
        calls.push({ to: marketAddress as Address, data: buyData });

        console.log(`[Pimlico] Gas dynamically checked: ${feeUSDC.toString()}`);
        console.log(`[Pimlico] Sending batched UserOperation (${calls.length} calls)...`);

        const txHash = await smartAccountClient.sendUserOperation({ calls });
        console.log(`[Pimlico] UserOperation sent! Waiting for confirmation...`);

        const receipt = await smartAccountClient.waitForUserOperationReceipt({ hash: txHash });
        const onChainHash = receipt.receipt.transactionHash;

        console.log(`[Pimlico] ✅ Confirmed: ${onChainHash}`);
        return onChainHash;
    }

    /**
     * Executes a gasless batched deposit for Web3 Users
     * Atomic UserOperation batch:
     *   1. approve(marketContract, amountUSDC)
     *   2. deposit(amountUSDC)
     */
    static async executeDeposit(
        privyWallet: any,
        marketAddress: string,
        usdcAddress: string,
        amountUSDC: bigint
    ): Promise<string> {
        console.log(
            `[Pimlico] Preparing gasless deposit | ` +
            `Amount: ${ethers.formatUnits(amountUSDC, USDC_DECIMALS)} USDC`
        );

        const smartAccountClient = await this.getSmartAccountClient(privyWallet);

        const approveData = encodeFunctionData({
            abi: parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]),
            functionName: "approve",
            args: [marketAddress as Address, amountUSDC],
        });

        const depositData = encodeFunctionData({
            abi: parseAbi(["function deposit(uint256 amount)"]),
            functionName: "deposit",
            args: [amountUSDC],
        });

        const calls: { to: Address; data: `0x${string}` }[] = [
            { to: usdcAddress as Address, data: approveData },
            { to: marketAddress as Address, data: depositData },
        ];

        console.log(`[Pimlico] Sending batched deposit UserOperation (${calls.length} calls)...`);

        const txHash = await smartAccountClient.sendUserOperation({ calls });
        console.log(`[Pimlico] UserOperation sent! Waiting for confirmation...`);

        const receipt = await smartAccountClient.waitForUserOperationReceipt({ hash: txHash });
        const onChainHash = receipt.receipt.transactionHash;

        console.log(`[Pimlico] ✅ Deposit Confirmed: ${onChainHash}`);
        return onChainHash;
    }

    /**
     * Executes a gasless batched swap for Web3 Users
     * Atomic UserOperation batch:
     *   1. approve(Router, amountIn)
     *   2. swapExactTokensForTokens(amountIn, 0, path, smartAccount, deadline)
     */
    static async executeSwap(
        privyWallet: any,
        tokenInAddress: string,
        tokenOutAddress: string,
        amountIn: bigint
    ): Promise<string> {
        console.log(
            `[Pimlico] Preparing gasless swap | ` +
            `Amount: ${ethers.formatUnits(amountIn, 18)}`
        );

        const ROUTER_ADDR = "0x10ED43C718714eb63d5aA57B78B54704E256024E"; // PancakeSwap V2 Router
        const smartAccountClient = await this.getSmartAccountClient(privyWallet);
        const smartAccountAddress = smartAccountClient.account.address;

        const approveData = encodeFunctionData({
            abi: parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]),
            functionName: "approve",
            args: [ROUTER_ADDR as Address, amountIn],
        });

        const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 10); // 10 minutes

        const swapData = encodeFunctionData({
            abi: parseAbi(["function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"]),
            functionName: "swapExactTokensForTokens",
            args: [amountIn, BigInt(0), [tokenInAddress as Address, tokenOutAddress as Address], smartAccountAddress, deadline],
        });

        const calls: { to: Address; data: `0x${string}` }[] = [
            { to: tokenInAddress as Address, data: approveData },
            { to: ROUTER_ADDR as Address, data: swapData },
        ];

        console.log(`[Pimlico] Sending batched swap UserOperation (${calls.length} calls)...`);

        const txHash = await smartAccountClient.sendUserOperation({ calls });
        console.log(`[Pimlico] UserOperation sent! Waiting for confirmation...`);

        const receipt = await smartAccountClient.waitForUserOperationReceipt({ hash: txHash });
        const onChainHash = receipt.receipt.transactionHash;

        console.log(`[Pimlico] ✅ Swap Confirmed: ${onChainHash}`);
        return onChainHash;
    }
}
