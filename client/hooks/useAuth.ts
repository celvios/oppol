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
 * Unified auth hook that checks both Privy (social login) and Reown (wallet connection)
 */
export function useAuth(): AuthState {
    const { authenticated: privyAuth, user: privyUser, ready: privyReady } = usePrivy();
    const { isConnected, address, status } = useAccount(); // Reown/Wagmi

    // Loading state: Privy not ready OR Wagmi reconnecting
    const isLoading = !privyReady || status === 'reconnecting';

    // Privy takes precedence if authenticated
    if (privyAuth && privyUser) {
        // --- Reliable login method detection ---
        // We can't trust linkedAccounts order (a user may have both Google AND wallet linked).
        // Instead:
        //   1. Check if an EXTERNAL wallet (walletClientType !== 'privy') is a linked account AND
        //      wagmi reports it as connected → this session is a wallet login.
        //   2. Otherwise fall back to social/email login type.

        type PrivyLoginMethod = 'google' | 'twitter' | 'discord' | 'email' | 'wallet' | 'privy';
        let loginMethod: PrivyLoginMethod = 'privy';

        const externalWallet = privyUser.linkedAccounts.find(
            (a) => a.type === 'wallet' && (a as any).walletClientType !== 'privy'
        );

        const isExternalWalletSession =
            // An external wallet is connected via wagmi and its address matches
            isConnected && address &&
            externalWallet &&
            (externalWallet as any).address?.toLowerCase() === address?.toLowerCase();

        if (isExternalWalletSession) {
            loginMethod = 'wallet';
        } else if (privyUser.linkedAccounts.some(a => a.type === 'google_oauth')) {
            loginMethod = 'google';
        } else if (privyUser.linkedAccounts.some(a => a.type === 'twitter_oauth')) {
            loginMethod = 'twitter';
        } else if (privyUser.linkedAccounts.some(a => a.type === 'discord_oauth')) {
            loginMethod = 'discord';
        } else if (privyUser.linkedAccounts.some(a => a.type === 'email')) {
            loginMethod = 'email';
        }

        // For external wallet sessions, use the wagmi address (0x4250...).
        // For social/email, use the Privy embedded wallet address.
        const effectiveWalletAddress = loginMethod === 'wallet'
            ? (address || privyUser.wallet?.address)
            : privyUser.wallet?.address;

        return {
            isAuthenticated: true,
            user: privyUser,
            walletAddress: effectiveWalletAddress,
            loginMethod,
            isLoading,
        };
    }

    // Fall back to Reown wallet connection
    if (isConnected && address) {
        return {
            isAuthenticated: true,
            user: null,
            walletAddress: address,
            loginMethod: 'wallet',
            isLoading: isLoading
        };
    }

    // Not authenticated
    return {
        isAuthenticated: false,
        user: null,
        walletAddress: undefined,
        loginMethod: null,
        isLoading: isLoading
    };
}
