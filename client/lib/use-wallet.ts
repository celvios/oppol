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
  const [stableConnection, setStableConnection] = useState<{address: string | null, isConnected: boolean} | null>(null);
  
  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const { connectAsync, isPending } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  
  // Get stored state for initialization
  const storedState = getStoredWalletState();

  // Initialize stable connection from storage
  useEffect(() => {
    if (!stableConnection && storedState) {
      setStableConnection(storedState);
    }
  }, [stableConnection, storedState]);

  // Update stable connection only when truly connected
  useEffect(() => {
    if (isConnected && address) {
      const newState = { address, isConnected: true };
      setStableConnection(newState);
      storeWalletState(address, true);
    } else if (!isConnected && !address && stableConnection?.isConnected) {
      // Only clear if we were previously connected and now fully disconnected
      setTimeout(() => {
        if (!isConnected && !address) {
          setStableConnection({ address: null, isConnected: false });
          storeWalletState(null, false);
        }
      }, 2000); // 2 second grace period for reconnection
    }
  }, [address, isConnected, stableConnection]);

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
      setStableConnection({ address: null, isConnected: false });
      storeWalletState(null, false);
    } catch (error) {
      console.error('[useWallet] Disconnect failed:', error);
    }
  };

  // Return stable connection state
  return {
    isConnected: stableConnection?.isConnected || false,
    address: stableConnection?.address || null,
    isConnecting: isConnecting || isPending,
    connect: connectWallet,
    disconnect: disconnectWallet
  };
}