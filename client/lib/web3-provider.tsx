'use client';

import { createWeb3Modal } from '@web3modal/wagmi/react';
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { WagmiProvider, cookieStorage, createStorage } from 'wagmi';
import { bsc, bscTestnet } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// WalletConnect Project ID
const projectId = '70415295a4738286445072f5c2392457';

// Metadata
const metadata = {
    name: 'OPoll',
    description: 'Decentralized Prediction Market',
    url: typeof window !== 'undefined' ? window.location.origin : 'https://oppollbnb.vercel.app',
    icons: ['https://oppollbnb.vercel.app/logo.png']
};

// Configure chains (BNB Mainnet and Testnet)
const chains = [bsc, bscTestnet] as const;

// Create wagmi config
const config = defaultWagmiConfig({
    chains,
    projectId,
    metadata,
    ssr: false, // Disable SSR to rely on client-side localStorage
    storage: createStorage({
        storage: typeof window !== 'undefined' ? window.localStorage : undefined
    }),
});

// Create query client
const queryClient = new QueryClient();

// Initialize Web3Modal
createWeb3Modal({
    wagmiConfig: config,
    projectId,
    enableAnalytics: false,
    enableOnramp: false,
    themeMode: 'dark',
    themeVariables: {
        '--w3m-accent': '#00FF94',
        '--w3m-border-radius-master': '8px',
    },
    featuredWalletIds: [
        'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
    ],
    mobileWallets: [
        {
            id: 'metamask',
            name: 'MetaMask',
            links: {
                native: 'metamask://',
                universal: 'https://metamask.app.link'
            }
        }
    ]
});

interface Web3ProviderProps {
    children: ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </WagmiProvider>
    );
}

export { config };
