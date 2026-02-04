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

  // User is considered connected if authenticated (Privy) OR wallet connected (Wagmi)
  const effectivelyConnected = authenticated || isConnected;
  const effectiveAddress = address || (wallets[0]?.address);

  return {
    // Connection state
    isConnected: effectivelyConnected,
    address: effectiveAddress || null,
    isConnecting: !ready,

    // Actions
    connect: login, // Privy's login handles everything
    disconnect: logout,

    // Compatibility
    connectAsync: login,
    connectors: wallets,
  };
}