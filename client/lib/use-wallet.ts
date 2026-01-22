'use client';

import { useEffect, useState, useCallback } from 'react';

interface WalletState {
  isConnected: boolean;
  address: string | null;
  isConnecting: boolean;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    address: null,
    isConnecting: false
  });

  useEffect(() => {
    // Load cached state immediately for fast hydration
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('wallet_cache');
      if (cached) {
        try {
          const { address, isConnected } = JSON.parse(cached);
          if (address && isConnected) {
            setState({
              isConnected: true,
              address,
              isConnecting: false
            });
          }
        } catch (e) { }
      }
    }

    // Listen for wallet changes from WagmiBridge
    const handleWalletChange = (event: CustomEvent) => {
      const { address, isConnected } = event.detail;
      setState({
        isConnected: isConnected || false,
        address: address || null,
        isConnecting: false
      });
    };

    window.addEventListener('wallet-changed', handleWalletChange as EventListener);

    return () => {
      window.removeEventListener('wallet-changed', handleWalletChange as EventListener);
    };
  }, []);

  const connect = useCallback(async () => {
    setState(prev => ({ ...prev, isConnecting: true }));

    try {
      // Dispatch event for WagmiBridge to open the modal
      window.dispatchEvent(new CustomEvent('wallet-connect-request'));
    } catch (error) {
      console.error('[useWallet] Connection failed:', error);
    } finally {
      setTimeout(() => {
        setState(prev => ({ ...prev, isConnecting: false }));
      }, 1000);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      localStorage.removeItem('wallet_cache');
      setState({
        isConnected: false,
        address: null,
        isConnecting: false
      });
      // Dispatch event for WagmiBridge to disconnect
      window.dispatchEvent(new CustomEvent('wallet-disconnect-request'));
    } catch (error) {
      console.error('[useWallet] Disconnect failed:', error);
    }
  }, []);

  return {
    isConnected: state.isConnected,
    address: state.address,
    isConnecting: state.isConnecting,
    connect,
    disconnect
  };
}
