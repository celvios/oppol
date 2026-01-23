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
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Get stored state immediately
  const storedState = getStoredWalletState();
  const [persistentState, setPersistentState] = useState(storedState || { address: null, isConnected: false });
  
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

  // Handle Wagmi state changes with debouncing
  useEffect(() => {
    if (!mounted) return;
    
    const currentAddress = address || null;
    const currentConnected = isConnected;
    
    // Clear any pending reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    // If we have stored connection but Wagmi shows disconnected, wait before updating
    if (storedState?.isConnected && !currentConnected) {
      console.log('[useWallet] Wagmi disconnected but storage shows connected, waiting for reconnect...');
      
      reconnectTimeoutRef.current = setTimeout(() => {
        // If still disconnected after timeout, update state
        if (!isConnected) {
          console.log('[useWallet] Reconnect timeout, updating to disconnected state');
          const newState = { address: null, isConnected: false };
          setPersistentState(newState);
          storeWalletState(null, false);
        }
      }, 3000); // 3 second grace period
      
      return;
    }
    
    // Update state if there's a real change
    if (currentAddress !== persistentState.address || currentConnected !== persistentState.isConnected) {
      console.log('[useWallet] State change:', { from: persistentState, to: { address: currentAddress, isConnected: currentConnected } });
      
      const newState = { address: currentAddress, isConnected: currentConnected };
      setPersistentState(newState);
      storeWalletState(currentAddress, currentConnected);
    }
  }, [address, isConnected, mounted, persistentState, storedState]);

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
      setPersistentState(newState);
      storeWalletState(null, false);
    } catch (error) {
      console.error('[useWallet] Disconnect failed:', error);
    }
  };

  // Return persistent state during mounting/navigation
  return {
    isConnected: mounted ? isConnected : persistentState.isConnected,
    address: mounted ? (address || null) : persistentState.address,
    isConnecting: isConnecting || isPending,
    connect: connectWallet,
    disconnect: disconnectWallet
  };
}