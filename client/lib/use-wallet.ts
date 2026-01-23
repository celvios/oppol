'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useEffect, useState } from 'react';

export function useWallet() {
  const [mounted, setMounted] = useState(false);
  
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
    // WagmiProvider not available, use defaults
  }
  
  const { address, isConnected } = account;
  const { connectAsync, isPending } = connect;
  const { disconnect: wagmiDisconnect } = disconnect;
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync Wagmi state to custom events for backward compatibility
  useEffect(() => {
    if (mounted) {
      window.dispatchEvent(new CustomEvent('wallet-changed', {
        detail: { address: address || null, isConnected }
      }));
    }
  }, [address, isConnected, mounted]);

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
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

  const disconnectWallet = async () => {
    try {
      wagmiDisconnect();
    } catch (error) {
      console.error('[useWallet] Disconnect failed:', error);
    }
  };

  return {
    isConnected: mounted ? isConnected : false,
    address: mounted ? (address || null) : null,
    isConnecting: isConnecting || isPending,
    connect: connectWallet,
    disconnect: disconnectWallet
  };
}
