'use client';

import { useAccount, useBalance, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { bsc, bscTestnet } from 'wagmi/chains';
import { getContracts } from './contracts';
import { useState, useEffect } from 'react';

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
    const { address: wagmiAddress, isConnected: wagmiConnected, isReconnecting, isConnecting, chain } = useAccount();

    const [custodialState, setCustodialState] = useState<{ isConnected: boolean; address: string | null }>({
        isConnected: false,
        address: null
    });

    useEffect(() => {
        const checkCustodial = () => {
            const token = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
            const addr = typeof window !== 'undefined' ? localStorage.getItem('wallet_address') : null;

            setCustodialState(prev => {
                if (prev.isConnected === !!token && prev.address === addr) return prev;
                return { isConnected: !!token, address: addr };
            });
        };

        checkCustodial();
        const interval = setInterval(checkCustodial, 1000);
        return () => clearInterval(interval);
    }, []);

    // Optimistic Connection Logic
    // If we are reconnecting, assume we are connected if we have a wagmi cached address
    // This prevents the UI from flashing the "Connect Wallet" screen during page loads/refresh
    const wagmiCachedAddress = typeof window !== 'undefined' ? localStorage.getItem('wagmi_cached_address') as `0x${string}` | null : null;

    // We are "effectively" connected if:
    // 1. Wagmi says we are connected
    // 2. We are custodial connected
    // 3. Wagmi is currently reconnecting AND we have a valid cached address (Optimistic)
    const effectiveConnected = wagmiConnected || custodialState.isConnected || (isReconnecting && !!wagmiCachedAddress);

    // The effective address follows the same logic
    const effectiveAddress = (wagmiAddress || custodialState.address || (isReconnecting ? wagmiCachedAddress : undefined)) as `0x${string}` | undefined;

    // Cache the address when we are truly connected via Wagmi
    useEffect(() => {
        if (wagmiConnected && wagmiAddress) {
            localStorage.setItem('wagmi_cached_address', wagmiAddress);
        }
    }, [wagmiConnected, wagmiAddress]);

    // Get native BNB balance
    const { data: bnbBalance } = useBalance({
        address: effectiveAddress,
        query: { enabled: !!effectiveAddress }
    });

    // Get platform token balance
    const { data: tokenBalance } = useReadContract({
        address: PLATFORM_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: effectiveAddress ? [effectiveAddress] : undefined,
        query: {
            enabled: !!effectiveAddress && PLATFORM_TOKEN_ADDRESS !== '0x0000000000000000000000000000000000000000',
        }
    });

    // Get USDC balance
    const { data: usdcBalance, refetch: refetchUsdc } = useReadContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: effectiveAddress ? [effectiveAddress] : undefined,
        query: {
            enabled: !!effectiveAddress,
        }
    });

    const isAdmin = tokenBalance ? tokenBalance >= ADMIN_THRESHOLD : false;

    const formattedBnbBalance = bnbBalance
        ? parseFloat(formatUnits(bnbBalance.value, bnbBalance.decimals)).toFixed(4)
        : '0';

    const formattedTokenBalance = tokenBalance
        ? parseFloat(formatUnits(tokenBalance, 18)).toLocaleString()
        : '0';

    const formattedUsdcBalance = usdcBalance
        ? parseFloat(formatUnits(usdcBalance, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0.00';

    return {
        address: effectiveAddress,
        isConnected: effectiveConnected,
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
        refetchUsdc,
        isAdmin,
        isCustodial: custodialState.isConnected,
    };
}

export { bsc, bscTestnet };
