'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useEffect, useState } from 'react';

// Storage keys for persistence
const WALLET_STORAGE_KEY = 'opoll-wallet-state';
const CONNECTION_TIMESTAMP_KEY = 'opoll-wallet-timestamp';

// Helper to get stored wallet state
function getStoredWalletState() {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(WALLET_STORAGE_KEY);
    const timestamp = localStorage.getItem(CONNECTION_TIMESTAMP_KEY);

    if (stored && timestamp) {
      const state = JSON.parse(stored);
      const connectionTime = parseInt(timestamp);

      // Consider connection valid for 24 hours
      if (Date.now() - connectionTime < 24 * 60 * 60 * 1000) {
        return state;
      }
    }
  } catch (e) {
    console.warn('[useWallet] Failed to read stored state:', e);
  }
  return null;
}

// Helper to store wallet state
function storeWalletState(address: string | null, isConnected: boolean) {
  if (typeof window === 'undefined') return;
  try {
    if (isConnected && address) {
      localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify({ address, isConnected }));
      localStorage.setItem(CONNECTION_TIMESTAMP_KEY, Date.now().toString());
    } else {
      localStorage.removeItem(WALLET_STORAGE_KEY);
      localStorage.removeItem(CONNECTION_TIMESTAMP_KEY);
    }
  } catch (e) {
    console.warn('[useWallet] Failed to store state:', e);
  }
}

import { useWeb3Modal } from '@web3modal/wagmi/react';

export function useWallet() {
  const [isConnecting, setIsConnecting] = useState(false);
  const { open } = useWeb3Modal();

  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const { connectAsync, isPending } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();

  // Get stored state and use it as the source of truth
  const storedState = getStoredWalletState();
  const [displayState, setDisplayState] = useState(() => {
    // Initialize with stored state if available
    return storedState || { address: null, isConnected: false };
  });

  // Only update display state when Wagmi shows a real connection
  useEffect(() => {
    if (isConnected && address) {
      // Connected - update immediately
      const newState = { address, isConnected: true };
      setDisplayState(newState);
      storeWalletState(address, true);
    }
    // Never update on disconnect - UI stays connected
  }, [address, isConnected]);

  const connectWallet = async () => {
    setIsConnecting(true);
    console.log('[useWallet] Opening Web3Modal...');
    try {
      await open();
      console.log('[useWallet] Web3Modal opened successfully');
    } catch (error) {
      console.error('[useWallet] Connection failed:', error);
      throw error; // Rethrow so caller knows it failed
    } finally {
      setTimeout(() => setIsConnecting(false), 2000);
    }
  };

  const disconnectWallet = async () => {
    try {
      wagmiDisconnect();
      // Only clear on manual disconnect
      const newState = { address: null, isConnected: false };
      setDisplayState(newState);
      storeWalletState(null, false);
    } catch (error) {
      console.error('[useWallet] Disconnect failed:', error);
    }
  };

  // Always return stored/display state - never Wagmi state directly
  return {
    isConnected: displayState.isConnected,
    address: displayState.address,
    isConnecting: isConnecting || isPending,
    connect: connectWallet,
    disconnect: disconnectWallet
  };
}