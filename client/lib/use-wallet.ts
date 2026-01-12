'use client';

import { useAccount, useBalance, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { bsc, bscTestnet } from 'wagmi/chains';
import { getContracts } from './contracts';

const PLATFORM_TOKEN_ADDRESS = '0x61Fc93c7C070B32B1b1479B86056d8Ec1D7125BD' as `0x${string}`;
const contracts = getContracts() as any;
const USDC_ADDRESS = (contracts.mockUSDC || '0x0eAD2Cc3B5eC12B69140410A1F4Dc8611994E6Be') as `0x${string}`;
const ADMIN_THRESHOLD = BigInt(50_000_000) * BigInt(10 ** 18);

const ERC20_ABI = [
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
] as const;

export function useWallet() {
    const { address, isConnected, chain } = useAccount();

    const { data: bnbBalance } = useBalance({
        address,
        query: { enabled: !!address }
    });

    const { data: tokenBalance } = useReadContract({
        address: PLATFORM_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: { enabled: !!address }
    });

    const { data: usdcBalance, refetch: refetchUsdc } = useReadContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: { enabled: !!address }
    });

    return {
        address,
        isConnected,
        chain,
        isMainnet: chain?.id === bsc.id,
        isTestnet: chain?.id === bscTestnet.id,
        bnbBalance: bnbBalance ? parseFloat(formatUnits(bnbBalance.value, bnbBalance.decimals)).toFixed(4) : '0',
        tokenBalance: tokenBalance ? parseFloat(formatUnits(tokenBalance, 18)).toLocaleString() : '0',
        rawTokenBalance: tokenBalance,
        usdcBalance: usdcBalance ? parseFloat(formatUnits(usdcBalance, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00',
        rawUsdcBalance: usdcBalance,
        refetchUsdc,
        isAdmin: tokenBalance ? tokenBalance >= ADMIN_THRESHOLD : false,
    };
}

export { bsc, bscTestnet };
