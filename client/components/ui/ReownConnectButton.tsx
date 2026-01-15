'use client';

import { useEffect, useState } from 'react';

export function ReownConnectButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Load Reown and create connect button
    const loadReown = async () => {
      try {
        const { createAppKit } = await import('@reown/appkit/react');
        const { EthersAdapter } = await import('@reown/appkit-adapter-ethers');
        const { bsc, bscTestnet } = await import('@reown/appkit/networks');
        
        const ethersAdapter = new EthersAdapter();
        
        const appKit = createAppKit({
          adapters: [ethersAdapter],
          networks: [bsc, bscTestnet],
          metadata: {
            name: 'OPoll',
            description: 'Decentralized Prediction Market',
            url: 'https://oppollbnb.vercel.app',
            icons: ['https://oppollbnb.vercel.app/favicon.ico']
          },
          projectId: '70415295a4738286445072f5c2392457',
          features: {
            analytics: false
          }
        });
        
        // Store reference globally
        (window as any).__appkit = appKit;
      } catch (error) {
        console.error('Failed to load Reown:', error);
      }
    };
    
    loadReown();
  }, []);

  const handleClick = () => {
    const appKit = (window as any).__appkit;
    if (appKit) {
      appKit.open();
    } else {
      console.error('AppKit not initialized');
    }
  };

  if (!mounted) {
    return (
      <button className={className} disabled>
        {children}
      </button>
    );
  }

  return (
    <button onClick={handleClick} className={className}>
      {children}
    </button>
  );
}