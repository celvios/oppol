'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useEffect, useState, useRef } from 'react';

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
  const [mounted, setMounted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Get stored state immediately
  const storedState = getStoredWalletState();
  const [displayState, setDisplayState] = useState(storedState || { address: null, isConnected: false });
  
  // Wagmi hooks
  let account = { address: undefined, isConnected: false };
  let connect = { connectAsync: async () => {}, isPending: false };
  let disconnect = { disconnect: () => {} };
  
  try {
    if (typeof window !== 'undefined') {
      account = useAccount();
      connect = useConnect();
      disconnect = useDisconnect();
    }
  } catch (e) {
    console.warn('[useWallet] Wagmi hooks not available:', e);
  }
  
  const { address, isConnected } = account;
  const { connectAsync, isPending } = connect;
  const { disconnect: wagmiDisconnect } = disconnect;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync Wagmi state with display state
  useEffect(() => {
    if (!mounted) return;
    
    const currentAddress = address || null;
    const currentConnected = isConnected;
    
    // Update display state and storage when Wagmi state changes
    if (currentAddress !== displayState.address || currentConnected !== displayState.isConnected) {
      const newState = { address: currentAddress, isConnected: currentConnected };
      setDisplayState(newState);
      storeWalletState(currentAddress, currentConnected);
    }
  }, [address, isConnected, mounted, displayState]);

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
      const newState = { address: null, isConnected: false };
      setDisplayState(newState);
      storeWalletState(null, false);
    } catch (error) {
      console.error('[useWallet] Disconnect failed:', error);
    }
  };

  // Always return stored state until mounted and Wagmi is ready
  return {
    isConnected: mounted ? isConnected : displayState.isConnected,
    address: mounted ? (address || null) : displayState.address,
    isConnecting: isConnecting || isPending,
    connect: connectWallet,
    disconnect: disconnectWallet
  };
}