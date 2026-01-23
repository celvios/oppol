'use client';

import { useWallet } from '@/lib/use-wallet';
import { useEffect, useState } from 'react';

/**
 * ReownConnectButton - Uses the existing Web3Modal from Web3Provider
 * Does NOT create its own wallet instance
 */
export function ReownConnectButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const [mounted, setMounted] = useState(false);
  const { connect, isConnecting } = useWallet();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className={className} disabled>
        {children}
      </button>
    );
  }

  return (
    <button 
      onClick={connect} 
      className={className}
      disabled={isConnecting}
    >
      {isConnecting ? 'Connecting...' : children}
    </button>
  );
}
