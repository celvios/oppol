
import { useState, useCallback } from 'react';
import { ethers, Contract } from 'ethers';
import { useWallet } from './use-wallet';
import { clientToSigner } from './viem-ethers-adapters';
import { useConnectorClient } from 'wagmi';

// PancakeSwap V2 Router ABI (Minimal)
const ROUTER_ABI = [
    "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)"
];

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function decimals() external view returns (uint8)"
];

// BSC Addresses
const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

export function usePancakeSwap() {
    const { address } = useWallet();
    const { data: connectorClient } = useConnectorClient();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [estimateError, setEstimateError] = useState<string | null>(null);

    // Estimate output amount
    const getEstimatedOutput = useCallback(async (
        amountIn: string,
        tokenIn: string,
        tokenOut: string
    ) => {
        setEstimateError(null);
        if (!amountIn || parseFloat(amountIn) === 0) return '0';

        try {
            const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed.binance.org/');
            const router = new Contract(PANCAKE_ROUTER, ROUTER_ABI, provider);

            // Path: TokenIn -> WBNB -> TokenOut (usually best route)
            // If tokenIn is BNB, use WBNB address
            const path = [
                tokenIn === 'BNB' ? WBNB : tokenIn,
                tokenOut
            ];

            // If direct pair exists or one is WBNB, path is length 2. 
            // Otherwise might need [TokenIn, WBNB, TokenOut]
            if (tokenIn !== 'BNB' && tokenIn !== WBNB && tokenOut !== WBNB) {
                path.splice(1, 0, WBNB);
            }

            // Remove duplicates if any (e.g. WBNB -> WBNB)
            const uniquePath = [...new Set(path)];

            // Handle decimals (assuming 18 for now, but should fetch)
            const amountInWei = ethers.parseUnits(amountIn, 18);

            const amounts = await router.getAmountsOut(amountInWei, uniquePath);
            const amountOut = amounts[amounts.length - 1];

            return ethers.formatUnits(amountOut, 18);
        } catch (err: any) {
            console.error("Error estimating swap:", err);
            // Detect common errors
            if (err.message && (err.message.includes("INSUFFICIENT_LIQUIDITY") || err.code === 'CALL_EXCEPTION')) {
                setEstimateError("Insufficient Liquidity: No Pool Found");
            } else {
                setEstimateError("Failed to fetch price");
            }
            return '0';
        }
    }, []);

    // Execute Swap
    const swap = useCallback(async (
        amountIn: string,
        tokenInAddress: string, // 'BNB' or address
        tokenOutAddress: string
    ) => {
        if (!connectorClient || !address) return;
        setIsLoading(true);
        setError(null);

        try {
            const signer = clientToSigner(connectorClient);
            const router = new Contract(PANCAKE_ROUTER, ROUTER_ABI, signer);

            const amountInWei = ethers.parseUnits(amountIn, 18);
            const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 mins

            const path = [
                tokenInAddress === 'BNB' ? WBNB : tokenInAddress,
                tokenOutAddress
            ];

            // If direct pair exists or one is WBNB, path is length 2. 
            // Otherwise might need [TokenIn, WBNB, TokenOut]
            if (tokenInAddress !== 'BNB' && tokenInAddress !== WBNB && tokenOutAddress !== WBNB) {
                path.splice(1, 0, WBNB);
            }
            const uniquePath = [...new Set(path)];

            // 1. Approve if Token Interaction
            if (tokenInAddress !== 'BNB') {
                const tokenContract = new Contract(tokenInAddress, ERC20_ABI, signer);
                const allowance = await tokenContract.allowance(address, PANCAKE_ROUTER);

                if (allowance < amountInWei) {
                    const tx = await tokenContract.approve(PANCAKE_ROUTER, ethers.MaxUint256);
                    await tx.wait();
                }

                // Swap Tokens for Tokens
                const tx = await router.swapExactTokensForTokens(
                    amountInWei,
                    0, // Slippage 100% allowed for now (should implement minAmountOut)
                    uniquePath,
                    address,
                    deadline
                );
                await tx.wait();
            } else {
                // Swap BNB for Tokens
                const tx = await router.swapExactETHForTokens(
                    0, // Slippage 100%
                    uniquePath,
                    address,
                    deadline,
                    { value: amountInWei }
                );
                await tx.wait();
            }

            return true;
        } catch (err: any) {
            console.error("Swap failed:", err);
            setError(err.reason || err.message || "Swap failed");
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [connectorClient, address]);

    return { getEstimatedOutput, swap, isLoading, error, estimateError };
}
