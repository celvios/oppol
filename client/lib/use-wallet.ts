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

export function useWallet() {
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Wagmi hooks - these are always available since Web3Provider is in root layout
  const { address, isConnected } = useAccount();
  const { connectAsync, isPending } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  
  // Get stored state for fallback
  const storedState = getStoredWalletState();

  // Store state when Wagmi state changes
  useEffect(() => {
    storeWalletState(address || null, isConnected);
  }, [address, isConnected]);

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      const modal = (window as any).web3modal;
      if (modal?.open) {
        await modal.open();
      }
    } catch (error) {
      console.error('[useWallet] Connection failed:', error);
    } finally {
      setTimeout(() => setIsConnecting(false), 2000);
    }
  };

  const disconnectWallet = async () => {
    try {
      wagmiDisconnect();
      storeWalletState(null, false);
    } catch (error) {
      console.error('[useWallet] Disconnect failed:', error);
    }
  };

  // Always return Wagmi state since Web3Provider is persistent
  // Only fallback to stored state if Wagmi shows disconnected but we have stored connection
  const shouldUseStored = !isConnected && storedState?.isConnected;
  
  return {
    isConnected: shouldUseStored ? true : isConnected,
    address: shouldUseStored ? storedState.address : (address || null),
    isConnecting: isConnecting || isPending,
    connect: connectWallet,
    disconnect: disconnectWallet
  };
}