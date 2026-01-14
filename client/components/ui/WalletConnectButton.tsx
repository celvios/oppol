'use client';

import { useWallet } from '@/lib/use-wallet';
import { Wallet, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';

export function WalletConnectButton({ minimal = false }: { minimal?: boolean }) {
  const { isConnected, address, connect, disconnect, isConnecting } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!mounted) {
    return (
      <button className="flex items-center gap-2 px-4 py-2 bg-primary/20 border border-primary/50 rounded-lg text-primary font-medium">
        <Wallet size={18} />
        {!minimal && <span>Connect Wallet</span>}
      </button>
    );
  }

  if (!isConnected) {
    return (
      <button
        onClick={connect}
        disabled={isConnecting}
        className={`flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/50 rounded-lg text-primary font-medium transition-all duration-200 ${minimal ? 'w-full justify-center px-0' : ''}`}
      >
        <Wallet size={18} />
        {!minimal && <span>{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>}
      </button>
    );
  }

  if (minimal) {
    return (
      <div className="w-full flex items-center gap-2">
        <button
          onClick={copyAddress}
          className="flex-1 flex items-center justify-center p-2 bg-white/5 hover:bg-white/10 hover:border-white/20 border border-transparent rounded-lg transition-all"
          title={copied ? 'Copied!' : address || ''}
        >
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse mr-2" />
          <span className="font-mono text-xs text-white">
            {copied ? 'Copied!' : `${address?.slice(0, 4)}...${address?.slice(-4)}`}
          </span>
        </button>
        <button
          onClick={disconnect}
          className="p-2 text-white/40 hover:text-red-400 transition-colors"
          title="Disconnect"
        >
          <LogOut size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={copyAddress}
        className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all duration-200"
        title={copied ? 'Copied!' : 'Click to copy address'}
      >
        <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
        <div className="flex flex-col items-start">
          <span className="text-xs text-white/60">Connected</span>
          <span className="text-sm font-mono text-white">
            {copied ? 'Copied!' : `${address?.slice(0, 6)}...${address?.slice(-4)}`}
          </span>
        </div>
      </button>

      <button
        onClick={disconnect}
        className="p-2 text-white/40 hover:text-red-400 transition-colors"
        title="Disconnect"
      >
        <LogOut size={18} />
      </button>
    </div>
  );
}