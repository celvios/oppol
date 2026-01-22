'use client';

import { useEffect, useState } from 'react';
import { waitForAppKit, getAppKitInstance } from './reown-provider';

interface WalletState {
  isConnected: boolean;
  address: string | null;
  isConnecting: boolean;
  signer?: any;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    address: null,
    isConnecting: false,
    signer: null
  });

  useEffect(() => {
    // Load cached state immediately
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

    // Listen for wallet changes
    const handleWalletChange = (event: any) => {
      console.log('[useWallet] Wallet change event received:', event.detail);
      const { address, isConnected } = event.detail;
      setState({
        isConnected: isConnected || false,
        address: address || null,
        isConnecting: false,
        signer: null
      });

      // Update cache
      if (isConnected && address) {
        localStorage.setItem('wallet_cache', JSON.stringify({ address, isConnected }));
      } else {
        localStorage.removeItem('wallet_cache');
      }
    };

    window.addEventListener('wallet-changed', handleWalletChange);

    // Also listen for MetaMask account changes
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        console.log('[useWallet] MetaMask accounts changed:', accounts);
        if (accounts.length > 0) {
          handleWalletChange({ detail: { address: accounts[0], isConnected: true } });
        } else {
          handleWalletChange({ detail: { address: null, isConnected: false } });
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        window.removeEventListener('wallet-changed', handleWalletChange);
        if (window.ethereum && window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        }
      };
    }
    return () => {
      window.removeEventListener('wallet-changed', handleWalletChange);
    };
  }, []);

  const connect = async () => {
    setState(prev => ({ ...prev, isConnecting: true }));

    try {
      console.log('[useWallet] Connect requested, waiting for AppKit...');
      
      // Wait for AppKit to be fully initialized
      const appKit = await waitForAppKit();
      
      if (appKit && appKit.open) {
        console.log('[useWallet] Opening AppKit modal...');
        await appKit.open();
      } else {
        // Fallback: dispatch event for the provider to handle
        console.log('[useWallet] Fallback: dispatching wallet-connect-request event');
        window.dispatchEvent(new CustomEvent('wallet-connect-request'));
      }
    } catch (error) {
      console.error('[useWallet] Connection failed:', error);
    } finally {
      setTimeout(() => {
        setState(prev => ({ ...prev, isConnecting: false }));
      }, 1000);
    }
  };

  const disconnect = async () => {
    try {
      console.log('[useWallet] Disconnecting...');
      
      // Clear local state first
      setState({
        isConnected: false,
        address: null,
        isConnecting: false
      });

      // Clear cache
      localStorage.removeItem('wallet_cache');

      // Try to disconnect from AppKit
      const appKit = getAppKitInstance();
      if (appKit && appKit.disconnect) {
        await appKit.disconnect();
      }

      // Dispatch event for other components
      window.dispatchEvent(new CustomEvent('wallet-changed', {
        detail: { address: null, isConnected: false }
      }));
    } catch (error) {
      console.error('[useWallet] Disconnect failed:', error);
    }
  };

  return {
    ...state,
    connect,
    disconnect
  };
}
