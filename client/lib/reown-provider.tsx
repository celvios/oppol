'use client';

import { createAppKit } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc, bscTestnet } from '@reown/appkit/networks';
import { ReactNode, useEffect, useState } from 'react';

// 1. Get projectId from https://cloud.reown.com
const projectId = '70415295a4738286445072f5c2392457';

// 2. Set the networks
const networks = [bsc, bscTestnet];

// 3. Create a metadata object - optional
const metadata = {
  name: 'OPoll',
  description: 'Decentralized Prediction Market',
  url: 'https://oppollbnb.vercel.app',
  icons: ['https://oppollbnb.vercel.app/favicon.ico']
};

// 4. Create Ethers adapter
const ethersAdapter = new EthersAdapter();

// 5. Lazy initialize AppKit only when needed
let appKitInitialized = false;

function initializeAppKit() {
  if (appKitInitialized) return;
  
  createAppKit({
    adapters: [ethersAdapter],
    networks,
    metadata,
    projectId,
    features: {
      analytics: false
    }
  });
  
  appKitInitialized = true;
}

export function ReownProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    // Initialize AppKit after component mounts
    setTimeout(initializeAppKit, 100);
  }, []);
  
  if (!mounted) {
    return <>{children}</>;
  }
  
  return <>{children}</>;
}