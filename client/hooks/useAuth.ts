'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';

export interface AuthState {
    isAuthenticated: boolean;
    user: any | null;
    walletAddress: string | undefined;
    loginMethod: 'privy' | 'wallet' | 'google' | 'twitter' | 'discord' | 'email' | null;
}

/**
 * Unified auth hook that checks both Privy (social login) and Reown (wallet connection)
 */
export function useAuth(): AuthState {
    const { authenticated: privyAuth, user: privyUser } = usePrivy();
    const { isConnected, address } = useAccount(); // Reown/Wagmi

    // Privy takes precedence if authenticated
    if (privyAuth && privyUser) {
        // Determine login method from linked accounts
        let loginMethod: 'google' | 'twitter' | 'discord' | 'email' | 'wallet' | 'privy' = 'privy';

        const google = privyUser.linkedAccounts.find((a) => a.type === 'google_oauth');
        const twitter = privyUser.linkedAccounts.find((a) => a.type === 'twitter_oauth');
        const discord = privyUser.linkedAccounts.find((a) => a.type === 'discord_oauth');
        const email = privyUser.linkedAccounts.find((a) => a.type === 'email');
        const wallet = privyUser.linkedAccounts.find((a) => a.type === 'wallet');

        if (google) loginMethod = 'google';
        else if (twitter) loginMethod = 'twitter';
        else if (discord) loginMethod = 'discord';
        else if (email) loginMethod = 'email';
        else if (wallet) loginMethod = 'wallet';

        return {
            isAuthenticated: true,
            user: privyUser,
            walletAddress: privyUser.wallet?.address || address,
            loginMethod: loginMethod,
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
