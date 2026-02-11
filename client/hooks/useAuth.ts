'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';

export interface AuthState {
    isAuthenticated: boolean;
    user: any | null;
    walletAddress: string | undefined;
    loginMethod: 'privy' | 'wallet' | null;
}

/**
 * Unified auth hook that checks both Privy (social login) and Reown (wallet connection)
 */
export function useAuth(): AuthState {
    const { authenticated: privyAuth, user: privyUser } = usePrivy();
    const { isConnected, address } = useAccount(); // Reown/Wagmi

    // Privy takes precedence if authenticated
    if (privyAuth && privyUser) {
        return {
            isAuthenticated: true,
            user: privyUser,
            walletAddress: privyUser.wallet?.address || address,
            loginMethod: 'privy',
        };
    }

    // Fall back to Reown wallet connection
    if (isConnected && address) {
        return {
            isAuthenticated: true,
            user: null,
            walletAddress: address,
            loginMethod: 'wallet',
        };
    }

    // Not authenticated
    return {
        isAuthenticated: false,
        user: null,
        walletAddress: undefined,
        loginMethod: null,
    };
}
