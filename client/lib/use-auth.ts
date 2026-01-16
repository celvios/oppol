'use client';

import { useAccount } from 'wagmi';
import { useEffect, useState } from 'react';

interface AuthState {
    // Authentication status
    isAuthenticated: boolean;
    isLoading: boolean;

    // Auth method
    authType: 'wallet' | 'custodial' | null;
    isCustodial: boolean;
    isWalletConnected: boolean;

    // Address
    address: string | undefined;
    custodialAddress: string | undefined;

    // Session
    sessionToken: string | null;
    userId: string | null;

    // Methods
    logout: () => void;
}

export function useAuth(): AuthState {
    const { address: walletAddress, isConnected, status } = useAccount();
    const [isHydrated, setIsHydrated] = useState(false);
    const [sessionToken, setSessionToken] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [custodialAddress, setCustodialAddress] = useState<string | undefined>(undefined);

    // Handle hydration
    useEffect(() => {
        setIsHydrated(true);

        // Check for session token
        const token = localStorage.getItem('session_token');
        setSessionToken(token);

        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                setUserId(payload.userId);
            } catch (e) {
                console.error('Invalid session token:', e);
                localStorage.removeItem('session_token');
                setSessionToken(null);
            }
        }
    }, []);

    // Fetch custodial address if user has session token
    useEffect(() => {
        if (!userId || !sessionToken) return;

        let mounted = true;

        async function fetchCustodialWallet() {
            try {
                const cachedKey = `cached_wallet_${userId}`;
                const cached = localStorage.getItem(cachedKey);

                if (cached && mounted) {
                    setCustodialAddress(cached);
                }

                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
                const response = await fetch(`${apiUrl}/api/wallet/${userId}`);

                if (response.ok) {
                    const data = await response.json();
                    if (mounted && data.success && data.wallet) {
                        const addr = data.wallet.public_address;
                        setCustodialAddress(addr);
                        localStorage.setItem(cachedKey, addr);
                    }
                }
            } catch (e) {
                console.warn('Failed to fetch custodial wallet:', e);
            }
        }

        fetchCustodialWallet();

        return () => { mounted = false; };
    }, [userId, sessionToken]);

    // Logout function
    const logout = () => {
        localStorage.removeItem('session_token');
        localStorage.removeItem('cached_wallet_address');
        // Clear all cached wallets
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('cached_wallet_')) {
                localStorage.removeItem(key);
            }
        });
        setSessionToken(null);
        setUserId(null);
        setCustodialAddress(undefined);
    };

    // Determine loading state
    const isLoading = !isHydrated || status === 'reconnecting';

    // Determine auth status
    const isWalletConnected = isHydrated && isConnected;
    const isCustodial = !!sessionToken;
    const isAuthenticated = isWalletConnected || isCustodial;

    // Determine auth type
    let authType: 'wallet' | 'custodial' | null = null;
    if (isCustodial) authType = 'custodial';
    else if (isWalletConnected) authType = 'wallet';

    // Determine effective address
    const effectiveAddress = walletAddress || custodialAddress;

    return {
        isAuthenticated,
        isLoading,
        authType,
        isCustodial,
        isWalletConnected,
        address: effectiveAddress,
        custodialAddress,
        sessionToken,
        userId,
        logout,
    };
}
