'use client';

import { useAccount, useBalance, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { bsc, bscTestnet } from 'wagmi/chains';
import { getContracts } from './contracts';

// Platform token address on BNB Chain
const PLATFORM_TOKEN_ADDRESS = '0x61Fc93c7C070B32B1b1479B86056d8Ec1D7125BD' as `0x${string}`;

// Get USDC address from contracts config
const contracts = getContracts() as any;
const USDC_ADDRESS = (contracts.mockUSDC || '0x0eAD2Cc3B5eC12B69140410A1F4Dc8611994E6Be') as `0x${string}`;

// Admin threshold: 50 million tokens (with 18 decimals)
const ADMIN_THRESHOLD = BigInt(50_000_000) * BigInt(10 ** 18);

// ERC20 ABI for balance check
const ERC20_ABI = [
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'decimals',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint8' }],
    },
] as const;

export function useWallet() {
    const { address, isConnected, isReconnecting, isConnecting, chain } = useAccount();

    // Get native BNB balance
    const { data: bnbBalance } = useBalance({
        address,
    });

    // Get platform token balance
    const { data: tokenBalance } = useReadContract({
        address: PLATFORM_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: {
            enabled: !!address && PLATFORM_TOKEN_ADDRESS !== '0x0000000000000000000000000000000000000000',
        }
    });

    // Get USDC balance
    const { data: usdcBalance } = useReadContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: {
            enabled: !!address,
        }
    });

    // Check if user is admin (has >= 50M tokens)
    const isAdmin = tokenBalance ? tokenBalance >= ADMIN_THRESHOLD : false;

    // Format balances for display
    const formattedBnbBalance = bnbBalance
        ? parseFloat(formatUnits(bnbBalance.value, bnbBalance.decimals)).toFixed(4)
        : '0';

    const formattedTokenBalance = tokenBalance
        ? parseFloat(formatUnits(tokenBalance, 18)).toLocaleString()
        : '0';

    // USDC has 6 decimals
    const formattedUsdcBalance = usdcBalance
        ? parseFloat(formatUnits(usdcBalance, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0.00';

    return {
        address,
        isConnected,
        isReconnecting,
        isConnecting,
        chain,
        isMainnet: chain?.id === bsc.id,
        isTestnet: chain?.id === bscTestnet.id,
        bnbBalance: formattedBnbBalance,
        tokenBalance: formattedTokenBalance,
        rawTokenBalance: tokenBalance,
        usdcBalance: formattedUsdcBalance,
        rawUsdcBalance: usdcBalance,
        isAdmin,
    };
}

// Export chain info for reference
export { bsc, bscTestnet };

