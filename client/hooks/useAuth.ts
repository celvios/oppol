'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';

export interface AuthState {
    isAuthenticated: boolean;
    user: any | null;
    walletAddress: string | undefined;
    loginMethod: 'privy' | 'wallet' | 'google' | 'twitter' | 'discord' | 'email' | null;
    isLoading: boolean;
}

/**
 * Unified auth hook.
 *
 * Two completely separate login paths:
 *   1. WALLET (Reown/AppKit) — wagmi isConnected is true, address is the real external wallet.
 *   2. SOCIAL (Privy) — privyAuth is true, address is the Privy-managed embedded wallet.
 *
 * Wallet takes priority if both are active simultaneously.
 */
export function useAuth(): AuthState {
    const { authenticated: privyAuth, user: privyUser, ready: privyReady } = usePrivy();
    const { isConnected, address, status } = useAccount(); // Reown/wagmi

    const isLoading = !privyReady || status === 'reconnecting';

    // --- Path 1: External Wallet (Reown/AppKit) ---
    // If wagmi reports a connected wallet, this is a wallet login.
    // Use the wagmi address directly — no Privy involvement.
    if (isConnected && address) {
        return {
            isAuthenticated: true,
            user: privyUser ?? null,
            walletAddress: address,
            loginMethod: 'wallet',
            isLoading,
        };
    }

    // --- Path 2: Privy Social Login (Google / Email / etc.) ---
    if (privyAuth && privyUser) {
        let loginMethod: 'google' | 'twitter' | 'discord' | 'email' | 'privy' = 'privy';

        if (privyUser.linkedAccounts.some(a => a.type === 'google_oauth')) loginMethod = 'google';
        else if (privyUser.linkedAccounts.some(a => a.type === 'twitter_oauth')) loginMethod = 'twitter';
        else if (privyUser.linkedAccounts.some(a => a.type === 'discord_oauth')) loginMethod = 'discord';
        else if (privyUser.linkedAccounts.some(a => a.type === 'email')) loginMethod = 'email';

        return {
            isAuthenticated: true,
            user: privyUser,
            walletAddress: privyUser.wallet?.address,
            loginMethod,
            isLoading,
        };
    }

    // --- Not authenticated ---
    return {
        isAuthenticated: false,
        user: null,
        walletAddress: undefined,
        loginMethod: null,
        isLoading,
    };
}
