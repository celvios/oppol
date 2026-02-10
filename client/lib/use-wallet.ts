import { useAppKit, useAppKitAccount } from '@reown/appkit/react';
import { useDisconnect } from 'wagmi';

export function useWallet() {
  const { open } = useAppKit();
  const { address, isConnected, status } = useAppKitAccount();
  const { disconnect } = useDisconnect();

  const handleConnect = async () => {
    await open();
  };

  return {
    isConnected: isConnected,
    address: address || null,
    isConnecting: status === 'connecting' || status === 'reconnecting',
    connect: handleConnect, // Opens Reown modal
    disconnect: disconnect,
    user: null, // Reown doesn't provide a unified user object in the same way. We maintain null to match minimal interface.
    connectors: [], // Reown handles connectors internally
  };
}
