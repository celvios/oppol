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
    url: 'https://oppollbnb.vercel.app',
    icons: ['https://oppollbnb.vercel.app/icon.png'],
    verifyUrl: 'https://oppollbnb.vercel.app',
};

// Configure chains (BNB Mainnet and Testnet)
const chains = [bsc, bscTestnet] as const;

// Create wagmi config
const config = defaultWagmiConfig({
    chains,
    projectId,
    metadata,
    ssr: true,
    enableCoinbase: true,
    enableInjected: true,
    enableWalletConnect: true,
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
    allowUnsupportedChain: false,
    allWallets: 'SHOW',
    includeWalletIds: [
        '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369', // Rainbow (best mobile)
        '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
        'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa', // Coinbase Wallet
        'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
    ],
    excludeWalletIds: [],
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
