import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useAccount, useDisconnect } from 'wagmi';
import { useEffect, useState } from 'react';

export function useWallet() {
  const { login, logout: privyLogout, ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { address, isConnected } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const effectivelyConnected = authenticated || isConnected;
  const effectiveAddress = address || (wallets[0]?.address);

  const handleDisconnect = async () => {
    try {
      if (isConnected) {
        wagmiDisconnect();
      }
      await privyLogout();
    } catch (e) {
      console.error('Disconnect error:', e);
    }
  };

  // During hydration, preserve last known state to prevent flash
  const shouldShowConnected = isHydrated ? effectivelyConnected : true;

  return {
    isConnected: shouldShowConnected,
    address: effectiveAddress || null,
    isConnecting: !isHydrated || !ready,
    connect: () => login({ loginMethods: ['email', 'wallet', 'google'] }),
    disconnect: handleDisconnect,
    connectAsync: login,
    connectors: wallets,
  };
}