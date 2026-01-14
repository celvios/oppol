'use client';

import { useState, useEffect } from 'react';

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

  const connect = async () => {
    setState(prev => ({ ...prev, isConnecting: true }));
    
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        
        if (accounts.length > 0) {
          setState({
            isConnected: true,
            address: accounts[0],
            isConnecting: false
          });
        }
      } else {
        // Fallback - simulate connection for demo
        setState({
          isConnected: true,
          address: '0x1234567890123456789012345678901234567890',
          isConnecting: false
        });
      }
    } catch (error) {
      console.error('Connection failed:', error);
      setState(prev => ({ ...prev, isConnecting: false }));
    }
  };

  return {
    ...state,
    connect
  };
}