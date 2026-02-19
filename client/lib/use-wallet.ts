import { useAuth } from "@/hooks/useAuth";
import { usePrivy } from "@privy-io/react-auth";
import { useDisconnect } from "wagmi";
import { useUIStore } from "@/lib/store";

export function useWallet() {
  const { isAuthenticated, isLoading, user: authUser, walletAddress, loginMethod } = useAuth();
  const { logout } = usePrivy();
  const { disconnect: wagmiDisconnect } = useDisconnect();

  const setLoginModalOpen = useUIStore((state) => state.setLoginModalOpen);
  const custodialAddress = useUIStore((state) => state.custodialAddress);

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

  // Determine effective address (Custodial > Privy/Wagmi)
  // Check if custodialAddress is valid before using it
  const effectiveAddress = (custodialAddress && custodialAddress !== '0x0000000000000000000000000000000000000000')
    ? custodialAddress
    : (walletAddress || null);

  // Map to the shape expected by components
  const user = isAuthenticated ? {
    name: authUser?.google?.name || authUser?.email?.address || 'User',
    email: authUser?.email?.address || null,
    image: authUser?.google?.picture || null,
    address: effectiveAddress
  } : null;

  return {
    isConnected: isAuthenticated,
    address: effectiveAddress, // Use custodial address if available
    isConnecting: isLoading, // Now correctly tracks Privy ready state
    connect: handleConnect, // Opens Global Modal
    disconnect: handleDisconnect,
    user,
    connectors: [], // Not exposed for hybrid
    loginMethod // Expose for UI logic
  };
}
