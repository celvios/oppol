'use client';

import { useEffect, useState } from 'react';

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
      } catch (e) {}
    }
    
    // Listen for wallet changes
    const handleWalletChange = (event: any) => {
      const { address, isConnected } = event.detail;
      setState({
        isConnected: isConnected || false,
        address: address || null,
        isConnecting: false
      });
    };
    
    window.addEventListener('wallet-changed', handleWalletChange);
    
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
      const modal = document.querySelector('w3m-modal, appkit-modal, [data-testid="w3m-modal"]');
      if (modal) {
        (modal as any).open?.();
      } else {
        // Try to find and click connect button
        const connectBtn = document.querySelector('w3m-connect-button, appkit-connect-button, [data-testid="connect-button"]');
        if (connectBtn) {
          (connectBtn as HTMLElement).click();
        } else {
          // Fallback - dispatch custom event to trigger modal
          window.dispatchEvent(new CustomEvent('wallet-connect-request'));
        }
      }
    } catch (error) {
      console.error('Connection failed:', error);
    } finally {
      setTimeout(() => {
        setState(prev => ({ ...prev, isConnecting: false }));
      }, 1000);
    }
  };
  
  return {
    ...state,
    connect
  };
}