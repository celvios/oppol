import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useAccount, useDisconnect } from 'wagmi';

export function useWallet() {
  const { login, logout: privyLogout, ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { address, isConnected } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();

  // User is considered connected if authenticated (Privy) OR wallet connected (Wagmi)
  // BUT: for explicit logout, we want to clear both
  const effectivelyConnected = authenticated || isConnected;
  const effectiveAddress = address || (wallets[0]?.address);

  // Combined disconnect function
  const handleDisconnect = async () => {
    try {
      // Disconnect Wagmi (External wallets)
      if (isConnected) {
        wagmiDisconnect();
      }
      // Logout Privy (Social/Embedded)
      await privyLogout();
    } catch (e) {
      console.error('Disconnect error:', e);
    }
  };

  return {
    // Connection state
    isConnected: effectivelyConnected,
    address: effectiveAddress || null,
    isConnecting: !ready,

    // Actions
    connect: login, // Privy's login handles everything
    disconnect: handleDisconnect, // Disconnects BOTH systems

    // Compatibility
    connectAsync: login,
    connectors: wallets,
  };
}