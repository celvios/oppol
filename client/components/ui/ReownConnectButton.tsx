'use client';

import { useEffect, useState } from 'react';

export function ReownConnectButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [appKit, setAppKit] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    
    // Load Reown dynamically to avoid SSR issues
    const loadReown = async () => {
      try {
        console.log('Loading Reown AppKit...');
        
        // Dynamic imports to avoid build issues
        const [{ createAppKit }, { EthersAdapter }, { bsc, bscTestnet }] = await Promise.all([
          import('@reown/appkit/react').catch(() => ({ createAppKit: null })),
          import('@reown/appkit-adapter-ethers').catch(() => ({ EthersAdapter: null })),
          import('@reown/appkit/networks').catch(() => ({ bsc: null, bscTestnet: null }))
        ]);
        
        if (!createAppKit || !EthersAdapter || !bsc || !bscTestnet) {
          console.warn('Reown dependencies not available, skipping initialization');
          return;
        }
        
        const ethersAdapter = new EthersAdapter();
        
        const appKitInstance = createAppKit({
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
          themeMode: 'dark',
          themeVariables: {
            '--w3m-z-index': '9999'
          }
        });
        
        console.log('AppKit created:', appKitInstance);
        setAppKit(appKitInstance);
        
        // Store reference globally
        (window as any).__appkit = appKitInstance;
        
        // Listen for connection events
        appKitInstance.subscribeAccount((account: any) => {
          console.log('Account changed:', account);
          if (account.isConnected && account.address) {
            localStorage.setItem('wallet_cache', JSON.stringify({
              address: account.address,
              isConnected: true
            }));
            
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
    const appKitInstance = appKit || (window as any).__appkit;
    console.log('AppKit instance:', appKitInstance);
    
    if (appKitInstance) {
      console.log('Opening AppKit modal...');
      try {
        appKitInstance.open();
      } catch (error) {
        console.error('Error opening AppKit:', error);
        if (appKitInstance.modal && appKitInstance.modal.open) {
          appKitInstance.modal.open();
        } else if (appKitInstance.openModal) {
          appKitInstance.openModal();
        }
      }
    } else {
      console.error('AppKit not initialized');
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