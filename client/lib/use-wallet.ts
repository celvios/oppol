/**
 * use-wallet hook - Privy wrapper
 * 
 * Simple wrapper around Privy for backwards compatibility
 */

'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';

export function useWallet() {
  const { login, logout, ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { address, isConnected } = useAccount();

  return {
    // Connection state
    isConnected: authenticated && isConnected,
    address: address || null,
    isConnecting: !ready,

    // Actions
    connect: login, // Privy's login handles everything
    disconnect: logout,

    // Compatibility
    connectAsync: login,
    connectors: wallets,
  };
}