import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useAccount, useDisconnect } from 'wagmi';

export function useWallet() {
  const { login, logout, ready, authenticated, user } = usePrivy();
  const { address, isConnected, isConnecting: isWagmiConnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const { wallets } = useWallets();

  // Unified "isConnected" state
  // We consider connected if EITHER Privy is authenticated OR Wagmi is connected
  // This covers both email/social logins (Privy) and direct wallet connections (Wagmi/Privy)
  const isWalletConnected = authenticated || isConnected;

  // Unified address
  // Prefer Wagmi address if available (active wallet), otherwise fallback to Privy wallet
  const walletAddress = address || user?.wallet?.address;

  const handleDisconnect = async () => {
    try {
      if (isConnected) disconnect();
      await logout();
    } catch (e) {
      console.error('Disconnect error:', e);
    }
  };

  return {
    isConnected: isWalletConnected,
    address: walletAddress || null,
    isConnecting: !ready || isWagmiConnecting,
    connect: login, // Opens Privy modal
    disconnect: handleDisconnect,
    connectors: wallets,
  };
}
