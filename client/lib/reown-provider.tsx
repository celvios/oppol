'use client';

import { ReactNode, useEffect, useState } from 'react';

let appKitInitialized = false;
let appKitInstance: any = null;
let initPromise: Promise<void> | null = null;

function initializeReown(): Promise<void> {
  if (appKitInitialized && appKitInstance) {
    return Promise.resolve();
  }
  
  if (initPromise) {
    return initPromise;
  }

  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  initPromise = new Promise((resolve) => {
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
              url: 'https://www.opoll.org',
              icons: ['https://www.opoll.org/favicon.ico']
            },
            projectId: '70415295a4738286445072f5c2392457',
            features: {
              analytics: false
            }
          });

          // Store instance globally for direct access
          (window as any).__appKitInstance = appKitInstance;

          // Listen for account changes
          appKitInstance.subscribeAccount((account: any) => {
            console.log('[Reown] Account changed:', account);
            localStorage.setItem('wallet_cache', JSON.stringify({
              address: account.address || null,
              isConnected: account.isConnected || false
            }));
            window.dispatchEvent(new CustomEvent('wallet-changed', {
              detail: { address: account.address, isConnected: account.isConnected }
            }));
          });

          // Listen for connect requests
          window.addEventListener('wallet-connect-request', async () => {
            console.log('[Reown] Connect request received, opening modal...');
            try {
              await appKitInstance.open();
            } catch (e) {
              console.error('[Reown] Failed to open modal:', e);
            }
          });

          appKitInitialized = true;
          console.log('[Reown] AppKit initialized successfully');
          resolve();
        });
      });
    }).catch((err) => {
      console.error('[Reown] Failed to initialize:', err);
      resolve(); // Resolve anyway to not block forever
    });
  });

  return initPromise;
}

// Export for use in useWallet
export function getAppKitInstance() {
  return appKitInstance || (window as any).__appKitInstance;
}

export async function waitForAppKit(): Promise<any> {
  await initializeReown();
  return getAppKitInstance();
}

export function ReownProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Initialize immediately, don't wait
    initializeReown();
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return <>{children}</>;
}
