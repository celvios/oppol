'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';

interface WalletState {
  isConnecting: boolean;
}

export function useWallet() {
  const { address, isConnected } = useAccount();
  const { open } = useWeb3Modal();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const [state, setState] = useState<WalletState>({
    isConnecting: false
  });

  // Update cache when wallet state changes
  useEffect(() => {
    if (isConnected && address) {
      localStorage.setItem('wallet_cache', JSON.stringify({ address, isConnected }));
    } else {
      localStorage.removeItem('wallet_cache');
    }
  }, [address, isConnected]);

  const connect = useCallback(async () => {
    setState({ isConnecting: true });

    try {
      console.log('[useWallet] Opening Web3Modal...');
      await open();
    } catch (error) {
      console.error('[useWallet] Connection failed:', error);
    } finally {
      setTimeout(() => {
        setState({ isConnecting: false });
      }, 1000);
    }
  }, [open]);

  const disconnect = useCallback(async () => {
    try {
      console.log('[useWallet] Disconnecting...');
      localStorage.removeItem('wallet_cache');
      wagmiDisconnect();
    } catch (error) {
      console.error('[useWallet] Disconnect failed:', error);
    }
  }, [wagmiDisconnect]);

  return {
    isConnected,
    address: address || null,
    isConnecting: state.isConnecting,
    connect,
    disconnect
  };
}
