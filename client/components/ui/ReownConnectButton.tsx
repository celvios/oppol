'use client';

import { useEffect, useState } from 'react';

export function ReownConnectButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Load Reown and create connect button
    const loadReown = async () => {
      try {
        console.log('Loading Reown AppKit...');
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
          },
          // Add mobile-specific options
          themeMode: 'dark',
          themeVariables: {
            '--w3m-z-index': '9999'
          }
        });
        
        console.log('AppKit created:', appKit);
        
        // Store reference globally
        (window as any).__appkit = appKit;
        
        // Listen for connection events
        appKit.subscribeAccount((account) => {
          console.log('Account changed:', account);
          if (account.isConnected && account.address) {
            // Cache the connection
            localStorage.setItem('wallet_cache', JSON.stringify({
              address: account.address,
              isConnected: true
            }));
            
            // Dispatch event for useWallet hook
            window.dispatchEvent(new CustomEvent('wallet-changed', {
              detail: { address: account.address, isConnected: true }
            }));
          } else {
            localStorage.removeItem('wallet_cache');
            window.dispatchEvent(new CustomEvent('wallet-changed', {
              detail: { address: null, isConnected: false }
            }));
          }
        });
        
      } catch (error) {
        console.error('Failed to load Reown:', error);
      }
    };
    
    loadReown();
  }, []);

  const handleClick = () => {
    console.log('Connect button clicked');
    const appKit = (window as any).__appkit;
    console.log('AppKit instance:', appKit);
    
    if (appKit) {
      console.log('Opening AppKit modal...');
      try {
        appKit.open();
      } catch (error) {
        console.error('Error opening AppKit:', error);
        // Fallback: try alternative methods
        if (appKit.modal && appKit.modal.open) {
          appKit.modal.open();
        } else if (appKit.openModal) {
          appKit.openModal();
        }
      }
    } else {
      console.error('AppKit not initialized');
      // Try to trigger wallet connection through other means
      window.dispatchEvent(new CustomEvent('wallet-connect-request'));
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