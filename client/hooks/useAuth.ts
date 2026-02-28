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
 * Priority order (most specific wins):
 *   1. SOCIAL (Privy) — if Privy is authenticated as a social/email/embedded user,
 *      this ALWAYS takes priority, even if wagmi also has a wallet connected.
 *      Wagmi stays connected when switching from MetaMask → email, so checking
 *      Privy first prevents the MetaMask address bleeding into the email session.
 *   2. WALLET (Reown/AppKit) — wagmi connected AND connector is not Privy AND
 *      Privy has no active social session.
 */
export function useAuth(): AuthState {
    const { authenticated: privyAuth, user: privyUser, ready: privyReady } = usePrivy();
    const { isConnected, address, status, connector } = useAccount();

    const isLoading = !privyReady || status === 'reconnecting';

    // --- Path 1: Privy Social Login (Google / Email / etc.) ---
    // Only trigger for Privy EMBEDDED wallet users (social/email logins).
    // A MetaMask user may also have Privy authenticated (linked account), but if an
    // external wallet is actively connected we must not treat them as custodial.
    const hasPrivyEmbeddedWallet = privyUser?.linkedAccounts?.some(
        (a: any) => a.type === 'wallet' && a.walletClientType === 'privy'
    );
    const isExternalWalletConnected = isConnected && !!address && connector?.id !== 'privy';

    if (privyAuth && privyUser && hasPrivyEmbeddedWallet && !isExternalWalletConnected) {
        let loginMethod: 'google' | 'twitter' | 'discord' | 'email' | 'privy' = 'privy';

        if (privyUser.linkedAccounts.some((a: any) => a.type === 'google_oauth')) loginMethod = 'google';
        else if (privyUser.linkedAccounts.some((a: any) => a.type === 'twitter_oauth')) loginMethod = 'twitter';
        else if (privyUser.linkedAccounts.some((a: any) => a.type === 'discord_oauth')) loginMethod = 'discord';
        else if (privyUser.linkedAccounts.some((a: any) => a.type === 'email')) loginMethod = 'email';

        console.log('[useAuth] Privy social session:', { loginMethod, walletAddress: privyUser.wallet?.address });

        return {
            isAuthenticated: true,
            user: privyUser,
            walletAddress: privyUser.wallet?.address,
            loginMethod,
            isLoading,
        };
    }

    // --- Path 2: External Wallet (Reown/AppKit) ---
    // Only reached when Privy has NO active social session.
    if (isConnected && address && connector?.id !== 'privy') {
        console.log('[useAuth] Wallet session:', { address, connectorId: connector?.id });
        return {
            isAuthenticated: true,
            user: null,
            walletAddress: address,
            loginMethod: 'wallet',
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
