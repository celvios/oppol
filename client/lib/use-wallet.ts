import { useAuth } from "@/hooks/useAuth";
import { usePrivy } from "@privy-io/react-auth";
import { useDisconnect } from "wagmi";
import { useUIStore } from "@/lib/store";

export function useWallet() {
  const { isAuthenticated, user: authUser, walletAddress, loginMethod } = useAuth();
  const { logout } = usePrivy();
  const { disconnect: wagmiDisconnect } = useDisconnect();

  const setLoginModalOpen = useUIStore((state) => state.setLoginModalOpen);

  const handleConnect = async () => {
    // Open the selection modal
    setLoginModalOpen(true);
  };

  const handleDisconnect = async () => {
    if (loginMethod === 'privy') {
      await logout();
    } else {
      wagmiDisconnect();
    }
  };

  // Map to the shape expected by components
  const user = isAuthenticated ? {
    name: authUser?.google?.name || authUser?.email?.address || 'User',
    email: authUser?.email?.address || null,
    image: authUser?.google?.picture || null,
    address: walletAddress
  } : null;

  return {
    isConnected: isAuthenticated,
    address: walletAddress || null,
    isConnecting: false, // Privy handles loading state internally mostly
    connect: handleConnect, // Opens Global Modal
    disconnect: handleDisconnect,
    user,
    connectors: [], // Not exposed for hybrid
  };
}
