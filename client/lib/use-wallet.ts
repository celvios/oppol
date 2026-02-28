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
    setLoginModalOpen(true);
  };

  const handleDisconnect = async () => {
    if (loginMethod !== 'wallet') {
      await logout();
    } else {
      wagmiDisconnect();
    }
  };

  // Determine effective address:
  // - Wallet (MetaMask) users: always use the wagmi/MetaMask EOA address
  // - Social/email (Privy) users: use custodialAddress (Safe SA) ONLY.
  //   NEVER fall back to walletAddress — that would show the WALLET account's
  //   balance during the async window before UserRegistrationManager finishes
  //   syncing the custodial address. null = "still loading" → pages show skeleton.
  let effectiveAddress: string | null;
  if (loginMethod === 'wallet') {
    effectiveAddress = walletAddress || null;
  } else if (loginMethod) {
    // Social/email user — only trust the custodialAddress from the store
    const isValidCustodial =
      custodialAddress &&
      custodialAddress !== '0x0000000000000000000000000000000000000000';
    effectiveAddress = isValidCustodial ? custodialAddress : null;
  } else {
    // loginMethod not set yet — treat as unauthenticated
    effectiveAddress = null;
  }

  console.log('[useWallet] DEBUG:', {
    loginMethod,
    walletAddress,
    custodialAddress,
    effectiveAddress,
    isAuthenticated,
  });

  const user = isAuthenticated ? {
    name: authUser?.google?.name || authUser?.email?.address || 'User',
    email: authUser?.email?.address || null,
    image: authUser?.google?.picture || null,
    address: effectiveAddress
  } : null;

  return {
    isConnected: isAuthenticated,
    address: effectiveAddress,
    isConnecting: isLoading,
    connect: handleConnect,
    disconnect: handleDisconnect,
    user,
    connectors: [],
    loginMethod
  };
}
