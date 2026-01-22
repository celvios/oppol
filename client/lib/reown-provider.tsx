'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useAccount } from 'wagmi';

/**
 * ReownProvider - Wagmi-compatible version
 * Works with Web3Provider's Wagmi context
 * Bridges Wagmi state to custom events for useWallet compatibility
 */
export function ReownProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { open } = useWeb3Modal();
  const { address, isConnected } = useAccount();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync Wagmi state to custom events (for useWallet hook)
  useEffect(() => {
    if (!mounted) return;

    console.log('[ReownProvider] Wallet state changed:', { address, isConnected });

    // Dispatch event for useWallet
    window.dispatchEvent(new CustomEvent('wallet-changed', {
      detail: { address: address || null, isConnected }
    }));

    // Update cache
    if (isConnected && address) {
      localStorage.setItem('wallet_cache', JSON.stringify({ address, isConnected }));
    } else {
      localStorage.removeItem('wallet_cache');
    }
  }, [address, isConnected, mounted]);

  // Listen for connection requests
  useEffect(() => {
    if (!mounted) return;

    const handleConnectRequest = () => {
      console.log('[ReownProvider] Opening modal...');
      open();
    };

    window.addEventListener('wallet-connect-request', handleConnectRequest);
    return () => window.removeEventListener('wallet-connect-request', handleConnectRequest);
  }, [open, mounted]);

  if (!mounted) {
    return <>{children}</>;
  }

  return <>{children}</>;
}

// Export helpers for backward compatibility
export function getAppKitInstance() {
  // Return null - we're using Wagmi hooks instead
  return null;
}

export async function waitForAppKit(): Promise<any> {
  // Return null - we're using Wagmi hooks instead
  return null;
}
