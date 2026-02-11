import { useSession, signOut } from "next-auth/react";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { useDisconnect } from "wagmi";
import { useUIStore } from "@/lib/store";

export function useWallet() {
  const { data: session, status: sessionStatus } = useSession();
  const { address: reownAddress, isConnected: isReownConnected, status: reownStatus } = useAppKitAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();

  const setLoginModalOpen = useUIStore((state) => state.setLoginModalOpen);

  // Combine Connection States
  const isConnected = !!session?.user || isReownConnected;
  const address = session?.user?.address || reownAddress || null;
  const isConnecting = sessionStatus === "loading" || reownStatus === "connecting" || reownStatus === "reconnecting";

  // Determine User Object
  const user = session?.user ? {
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
    address: session.user.address
  } : (isReownConnected && reownAddress ? {
    name: null,
    email: null,
    image: null,
    address: reownAddress
  } : null);

  const handleConnect = async () => {
    // Open the selection modal
    setLoginModalOpen(true);
  };

  const handleDisconnect = async () => {
    if (session?.user) {
      await signOut();
    }
    if (isReownConnected) {
      wagmiDisconnect();
    }
  };

  return {
    isConnected,
    address,
    isConnecting,
    connect: handleConnect, // Opens Global Modal
    disconnect: handleDisconnect,
    user,
    connectors: [], // Not exposed for hybrid
  };
}
