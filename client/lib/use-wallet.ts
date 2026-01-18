'use client';

import { useEffect, useState } from 'react';

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
      console.log('Wallet change event received:', event.detail);
      const { address, isConnected } = event.detail;
      setState({
        isConnected: isConnected || false,
        address: address || null,
        isConnecting: false,
        signer: null // Reset signer when wallet changes
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
        console.log('MetaMask accounts changed:', accounts);
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
      // Wait for Reown to be initialized
      await new Promise(resolve => setTimeout(resolve, 500));

      // Try multiple methods to open the modal
      // Dispatch custom event to trigger Reown modal (primary method)
      window.dispatchEvent(new CustomEvent('wallet-connect-request'));

      // Also try to direct open if event listener isn't caught immediately or legacy
      const modal = document.querySelector('w3m-modal, appkit-modal, [data-testid="w3m-modal"]');
      if (modal) {
        (modal as any).open?.();
      }

      const connectBtn = document.querySelector('w3m-connect-button, appkit-connect-button, [data-testid="connect-button"]');
      if (connectBtn) {
        (connectBtn as HTMLElement).click();
      }
    } catch (error) {
      console.error('Connection failed:', error);
    } finally {
      setTimeout(() => {
        setState(prev => ({ ...prev, isConnecting: false }));
      }, 1000);
    }
  };

  const disconnect = async () => {
    try {
      // Clear local state
      setState({
        isConnected: false,
        address: null,
        isConnecting: false
      });

      // Clear cache
      localStorage.removeItem('wallet_cache');

      // Try to disconnect from AppKit if available
      const appKit = (window as any).__appkit;
      if (appKit && appKit.disconnect) {
        await appKit.disconnect();
      }

      // Dispatch event for other components
      window.dispatchEvent(new CustomEvent('wallet-changed', {
        detail: { address: null, isConnected: false }
      }));
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  };

  return {
    ...state,
    connect,
    disconnect
  };
}