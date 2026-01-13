'use client';

import { useWalletContext } from './wallet-provider';

export function useWallet() {
    const { address, isConnected, chainId } = useWalletContext();

    return {
        address,
        isConnected,
        isReconnecting: false,
        isConnecting: false,
        chain: chainId ? { id: chainId, name: chainId === 97 ? 'BSC Testnet' : 'BSC Mainnet' } : null,
        isMainnet: chainId === 56,
        isTestnet: chainId === 97,
        bnbBalance: '0',
        tokenBalance: '0',
        rawTokenBalance: BigInt(0),
        usdcBalance: '0.00',
        rawUsdcBalance: BigInt(0),
        refetchUsdc: async () => {},
        isAdmin: false,
    };
}

export const bsc = { id: 56, name: 'BNB Smart Chain' };
export const bscTestnet = { id: 97, name: 'BNB Smart Chain Testnet' };
