import { useSession, signIn, signOut } from "next-auth/react";

export function useWallet() {
  const { data: session, status } = useSession();

  const isConnected = !!session?.user;
  const address = session?.user?.address || null;
  const isConnecting = status === "loading";

  const handleConnect = async () => {
    await signIn('google');
  };

  const handleDisconnect = async () => {
    await signOut();
  };

  return {
    isConnected,
    address,
    isConnecting,
    connect: handleConnect, // Opens Google Sign-In
    disconnect: handleDisconnect,
    user: session?.user || null,
    connectors: [], // Not used for Google Login
  };
}
