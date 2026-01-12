'use client';

import { useEffect, useState } from 'react';

export function useCustodialWallet() {
    const [isConnected, setIsConnected] = useState(false);
    const [address, setAddress] = useState<string | null>(null);
    const [sessionToken, setSessionToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check for existing session
        const token = localStorage.getItem('session_token');
        const cachedAddress = localStorage.getItem('cached_wallet_address');
        
        if (token && cachedAddress) {
            setSessionToken(token);
            setAddress(cachedAddress);
            setIsConnected(true);
        }
        
        setIsLoading(false);
    }, []);

    const login = async (walletAddress: string) => {
        setIsLoading(true);
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
                setAddress(data.address);
                setIsConnected(true);
                return { success: true };
            }
            
            return { success: false, error: data.message };
        } catch (error) {
            return { success: false, error: 'Failed to connect' };
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem('session_token');
        localStorage.removeItem('cached_wallet_address');
        setSessionToken(null);
        setAddress(null);
        setIsConnected(false);
    };

    return {
        isConnected,
        address,
        sessionToken,
        isLoading,
        login,
        logout,
    };
}
