'use client';

import { ReactNode, useEffect, useState } from 'react';

let appKitInitialized = false;
let appKitInstance: any = null;

function initializeReown() {
  if (appKitInitialized || typeof window === 'undefined') return;
  
  import('@reown/appkit/react').then(({ createAppKit }) => {
    import('@reown/appkit-adapter-ethers').then(({ EthersAdapter }) => {
      import('@reown/appkit/networks').then(({ bsc, bscTestnet }) => {
        const ethersAdapter = new EthersAdapter();
        
        appKitInstance = createAppKit({
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
        
        // Listen for account changes
        appKitInstance.subscribeAccount((account: any) => {
          if (account.address) {
            localStorage.setItem('wallet_cache', JSON.stringify({
              address: account.address,
              isConnected: account.isConnected
            }));
            // Trigger a custom event for the hook to listen to
            window.dispatchEvent(new CustomEvent('wallet-changed', {
              detail: { address: account.address, isConnected: account.isConnected }
            }));
          }
        });
        
        appKitInitialized = true;
      });
    });
  });
}

export function ReownProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    setTimeout(initializeReown, 100);
  }, []);
  
  if (!mounted) {
    return <>{children}</>;
  }
  
  return <>{children}</>;
}