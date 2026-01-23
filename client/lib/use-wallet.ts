'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useEffect, useState } from 'react';

export function useWallet() {
  const { address, isConnected } = useAccount();
  const { connectAsync, isPending } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const [isConnecting, setIsConnecting] = useState(false);

  // Sync Wagmi state to custom events for backward compatibility
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('wallet-changed', {
      detail: { address: address || null, isConnected }
    }));
  }, [address, isConnected]);

  const connect = async () => {
    setIsConnecting(true);
    try {
      // Open Web3Modal
      const modal = (window as any).web3modal;
      if (modal && modal.open) {
        await modal.open();
      } else {
        window.dispatchEvent(new CustomEvent('wallet-connect-request'));
      }
    } catch (error) {
      console.error('[useWallet] Connection failed:', error);
    } finally {
      setTimeout(() => setIsConnecting(false), 1000);
    }
  };

  const disconnect = async () => {
    try {
      wagmiDisconnect();
    } catch (error) {
      console.error('[useWallet] Disconnect failed:', error);
    }
  };

  return {
    isConnected,
    address: address || null,
    isConnecting: isConnecting || isPending,
    connect,
    disconnect
  };
}
