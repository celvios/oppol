'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useEffect, useState, useCallback } from 'react';

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
  
  // Initialize with stored state for immediate availability
  const [cachedState, setCachedState] = useState(() => {
    const stored = getStoredWalletState();
    return stored || { address: null, isConnected: false };
  });
  
  // Safe defaults for SSR
  let account = { address: undefined, isConnected: false };
  let connect = { connectAsync: async () => {}, isPending: false };
  let disconnect = { disconnect: () => {} };
  
  // Only use Wagmi hooks on client side
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

  // Mount effect
  useEffect(() => {
    setMounted(true);
    console.log('[useWallet] Component mounted, stored state:', cachedState);
  }, [cachedState]);

  // Sync Wagmi state with local storage and cached state
  useEffect(() => {
    if (!mounted) return;
    
    const currentAddress = address || null;
    const currentConnected = isConnected;
    
    console.log('[useWallet] Wagmi state changed:', { 
      address: currentAddress, 
      isConnected: currentConnected,
      cached: cachedState 
    });
    
    // Update cached state if Wagmi state is different
    if (currentAddress !== cachedState.address || currentConnected !== cachedState.isConnected) {
      const newState = { address: currentAddress, isConnected: currentConnected };
      setCachedState(newState);
      storeWalletState(currentAddress, currentConnected);
      
      // Dispatch event for backward compatibility
      window.dispatchEvent(new CustomEvent('wallet-changed', {
        detail: newState
      }));
    }
  }, [address, isConnected, mounted, cachedState]);

  // Ensure Web3Modal instance is available
  const ensureModal = useCallback(() => {
    if (typeof window === 'undefined') return null;
    
    let modal = (window as any).web3modal;
    if (!modal) {
      console.warn('[useWallet] Web3Modal not found, triggering initialization');
      // Trigger modal initialization
      window.dispatchEvent(new CustomEvent('init-web3modal'));
      modal = (window as any).web3modal;
    }
    return modal;
  }, []);

  const connectWallet = async () => {
    console.log('[useWallet] Connect wallet requested');
    setIsConnecting(true);
    
    try {
      const modal = ensureModal();
      if (modal && modal.open) {
        console.log('[useWallet] Opening Web3Modal');
        await modal.open();
      } else {
        console.log('[useWallet] Dispatching connect request event');
        window.dispatchEvent(new CustomEvent('wallet-connect-request'));
      }
    } catch (error) {
      console.error('[useWallet] Connection failed:', error);
    } finally {
      // Longer timeout to account for user interaction
      setTimeout(() => setIsConnecting(false), 2000);
    }
  };

  const disconnectWallet = async () => {
    console.log('[useWallet] Disconnect wallet requested');
    try {
      wagmiDisconnect();
      // Clear cached state immediately
      const newState = { address: null, isConnected: false };
      setCachedState(newState);
      storeWalletState(null, false);
      
      window.dispatchEvent(new CustomEvent('wallet-changed', {
        detail: newState
      }));
    } catch (error) {
      console.error('[useWallet] Disconnect failed:', error);
    }
  };

  // Return the most current state available
  const finalState = {
    isConnected: mounted ? isConnected : cachedState.isConnected,
    address: mounted ? (address || null) : cachedState.address,
    isConnecting: isConnecting || isPending,
    connect: connectWallet,
    disconnect: disconnectWallet
  };
  
  console.log('[useWallet] Returning state:', finalState);
  return finalState;
}
