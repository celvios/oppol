'use client';

import { useWalletContext } from './wallet-provider';

export function useCustodialWallet() {
    const { address, isConnected, isConnecting } = useWalletContext();

    return {
        isConnected,
        isAuthenticated: isConnected,
        isLoading: isConnecting,
        isCustodial: false,
        isWalletConnected: isConnected,
        authType: isConnected ? ('wallet' as const) : null,
        address,
        custodialAddress: null,
        wagmiAddress: address,
        sessionToken: null,
        login: async () => ({ success: false }),
        logout: () => {},
    };
}
