/**
 * Social Login Hook
 * 
 * Handles ONLY Privy social logins (Google, Email)
 * NEVER interacts with Web3Modal to avoid session conflicts.
 */

'use client';

import { usePrivy, useLoginWithOAuth, useLoginWithEmail } from '@privy-io/react-auth';
import { useState } from 'react';

export function useSocialLogin() {
    const { login, logout, ready, authenticated, user } = usePrivy();
    const { initOAuth } = useLoginWithOAuth();
    const { sendCode, loginWithCode } = useLoginWithEmail();

    const [isLoading, setIsLoading] = useState(false);

    const loginWithGoogle = async () => {
        try {
            console.log('[useSocialLogin] Google login attempt...');
            setIsLoading(true);
            await initOAuth({ provider: 'google' });
            // OAuth redirects, loading state persists until redirect
        } catch (error) {
            console.error('[useSocialLogin] Google login failed:', error);
            setIsLoading(false);
            throw error;
        }
    };

    const sendEmailCode = async (email: string) => {
        try {
            console.log('[useSocialLogin] Sending email code to:', email);
            setIsLoading(true);
            await sendCode({ email });
            console.log('[useSocialLogin] Email code sent successfully');
        } catch (error) {
            console.error('[useSocialLogin] Failed to send email code:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const verifyEmailCode = async (email: string, code: string) => {
        try {
            console.log('[useSocialLogin] Verifying email code...');
            setIsLoading(true);
            await loginWithCode({ code }); // Privy API only needs code
            console.log('[useSocialLogin] Email verification successful');
        } catch (error) {
            console.error('[useSocialLogin] Email verification failed:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const logoutSocial = async () => {
        try {
            console.log('[useSocialLogin] Logging out from social login...');
            await logout();
        } catch (error) {
            console.error('[useSocialLogin] Logout failed:', error);
        }
    };

    return {
        // State
        isAuthenticated: authenticated,
        isReady: ready,
        isLoading,
        user,

        // Methods
        loginWithGoogle,
        sendEmailCode,
        verifyEmailCode,
        logout: logoutSocial,
    };
}
