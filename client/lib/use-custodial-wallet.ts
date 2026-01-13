'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';

export function useCustodialWallet() {
    // Wagmi wallet connection
    const { address: wagmiAddress, isConnected: wagmiConnected, status } = useAccount();

    // Custodial state
    const [custodialAddress, setCustodialAddress] = useState<string | null>(null);
    const [sessionToken, setSessionToken] = useState<string | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        // Check for existing custodial session
        const token = localStorage.getItem('session_token');
        const cachedAddress = localStorage.getItem('cached_wallet_address');

        if (token && cachedAddress) {
            setSessionToken(token);
            setCustodialAddress(cachedAddress);
        }

        setIsHydrated(true);
    }, []);

    const login = async (walletAddress: string) => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
            const response = await fetch(`${apiUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: walletAddress }),
            });

            const data = await response.json();

            if (data.success) {
                localStorage.setItem('session_token', data.token);
                localStorage.setItem('cached_wallet_address', data.address);
                setSessionToken(data.token);
                setCustodialAddress(data.address);
                return { success: true };
            }

            return { success: false, error: data.message };
        } catch (error) {
            return { success: false, error: 'Failed to connect' };
        }
    };

    const logout = () => {
        localStorage.removeItem('session_token');
        localStorage.removeItem('cached_wallet_address');
        setSessionToken(null);
        setCustodialAddress(null);
    };

    // Unified state
    const isLoading = !isHydrated || status === 'reconnecting';

    // User is connected if EITHER:
    // 1. They have a custodial session (Google/WhatsApp login)
    // 2. They have a wallet connected (MetaMask/Trust Wallet)
    // Note: Don't gate isWalletConnected on isHydrated - wagmiConnected is reliable
    const isCustodial = !!sessionToken && !!custodialAddress;
    const isWalletConnected = wagmiConnected; // Trust Wagmi immediately
    const isConnected = isCustodial || isWalletConnected;

    // Determine effective address (wagmi takes priority if both exist)
    const address = wagmiAddress || custodialAddress;

    // Determine auth type for compatibility with useAuth
    const authType: 'wallet' | 'custodial' | null = isCustodial ? 'custodial' : isWalletConnected ? 'wallet' : null;

    return {
        // Connection status
        isConnected,
        isAuthenticated: isConnected, // Alias for useAuth compatibility
        isLoading,
        isCustodial,
        isWalletConnected,

        // Auth type (for useAuth compatibility)
        authType,

        // Address
        address,
        custodialAddress,
        wagmiAddress,

        // Session
        sessionToken,

        // Methods
        login,
        logout,
    };
}
