/**
 * External Wallet Connection Hook
 * 
 * Handles ONLY Web3Modal connections for external wallets (MetaMask, SafePal, etc.)
 * NEVER interacts with Privy to avoid session conflicts.
 */

'use client';

import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useAccount, useDisconnect } from 'wagmi';
import { useState, useEffect } from 'react';
import { debounceConnection, clearStuckState } from './connection-utils';

// Storage keys for external wallet sessions (isolated from Privy)
const EXTERNAL_WALLET_KEY = 'EXTERNAL_WALLET_SESSION';
const EXTERNAL_WALLET_TIMESTAMP = 'EXTERNAL_WALLET_TIMESTAMP';

// Get stored external wallet state
function getExternalWalletState() {
    if (typeof window === 'undefined') return null;
    try {
        const stored = localStorage.getItem(EXTERNAL_WALLET_KEY);
        const timestamp = localStorage.getItem(EXTERNAL_WALLET_TIMESTAMP);

        if (stored && timestamp) {
            const state = JSON.parse(stored);
            const connectionTime = parseInt(timestamp);

            // Consider connection valid for 24 hours
            if (Date.now() - connectionTime < 24 * 60 * 60 * 1000) {
                return state;
            }
        }
    } catch (e) {
        console.warn('[useExternalWallet] Failed to read stored state:', e);
    }
    return null;
}

// Store external wallet state (isolated from Privy)
function storeExternalWalletState(address: string | null, isConnected: boolean) {
    if (typeof window === 'undefined') return;
    try {
        if (isConnected && address) {
            localStorage.setItem(EXTERNAL_WALLET_KEY, JSON.stringify({ address, isConnected }));
            localStorage.setItem(EXTERNAL_WALLET_TIMESTAMP, Date.now().toString());
        } else {
            localStorage.removeItem(EXTERNAL_WALLET_KEY);
            localStorage.removeItem(EXTERNAL_WALLET_TIMESTAMP);
        }
    } catch (e) {
        console.warn('[useExternalWallet] Failed to store state:', e);
    }
}

export function useExternalWallet() {
    const [isConnecting, setIsConnecting] = useState(false);
    const { open } = useWeb3Modal();

    // Wagmi hooks for external wallet state
    const { address, isConnected } = useAccount();
    const { disconnect: wagmiDisconnect } = useDisconnect();

    // Get stored state
    const storedState = getExternalWalletState();
    const [displayState, setDisplayState] = useState(() => {
        return storedState || { address: null, isConnected: false };
    });

    // Update display state when Wagmi shows real connection
    useEffect(() => {
        if (isConnected && address) {
            console.log('[useExternalWallet] External wallet connected:', address);
            const newState = { address, isConnected: true };
            setDisplayState(newState);
            storeExternalWalletState(address, true);
        }
    }, [address, isConnected]);

    const connect = async () => {
        try {
            console.log('[useExternalWallet] External wallet connection attempt...');

            await debounceConnection(async () => {
                setIsConnecting(true);

                // Clear any stuck Web3Modal state
                clearStuckState();

                console.log('[useExternalWallet] Opening Web3Modal...');
                await open();
                console.log('[useExternalWallet] Web3Modal opened successfully');
            });

        } catch (error: any) {
            console.error('[useExternalWallet] Connection failed:', error);

            if (error.message?.includes('already in progress') || error.message?.includes('wait')) {
                console.warn('[useExternalWallet] Connection debounced:', error.message);
            }

            throw error;
        } finally {
            setTimeout(() => setIsConnecting(false), 2000);
        }
    };

    const disconnect = async () => {
        try {
            console.log('[useExternalWallet] Disconnecting external wallet...');
            wagmiDisconnect();
            const newState = { address: null, isConnected: false };
            setDisplayState(newState);
            storeExternalWalletState(null, false);
        } catch (error) {
            console.error('[useExternalWallet] Disconnect failed:', error);
        }
    };

    return {
        isConnected: displayState.isConnected,
        address: displayState.address,
        isConnecting,
        connect,
        disconnect,
    };
}
