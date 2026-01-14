'use client';

import { useEffect, useState, useMemo } from 'react';

export function useWallet() {
  const [cachedAddress, setCachedAddress] = useState<string | null>(null);
  const [cachedConnected, setCachedConnected] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Load cached state immediately
  useEffect(() => {
    const cached = localStorage.getItem('wallet_cache');
    if (cached) {
      try {
        const { address: addr, isConnected: connected } = JSON.parse(cached);
        setCachedAddress(addr);
        setCachedConnected(connected);
      } catch (e) {}
    }
    setMounted(true);
  }, []);
  
  // Memoize wallet functions to prevent re-renders
  const walletFunctions = useMemo(() => {
    const connect = async () => {
      try {
        const { useAppKit } = await import('@reown/appkit/react');
        const appKit = useAppKit();
        await appKit.open();
      } catch (e) {
        console.warn('Connect failed:', e);
      }
    };

    const disconnect = async () => {
      try {
        const { useAppKit } = await import('@reown/appkit/react');
        const appKit = useAppKit();
        await appKit.open({ view: 'Account' });
      } catch (e) {
        console.warn('Disconnect failed:', e);
      }
      localStorage.removeItem('wallet_cache');
      setCachedAddress(null);
      setCachedConnected(false);
    };
    
    return { connect, disconnect };
  }, []);

  return {
    address: cachedAddress,
    isConnected: cachedConnected,
    isConnecting: false,
    ...walletFunctions,
  };
}