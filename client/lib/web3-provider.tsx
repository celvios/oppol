/**
 * Web3 Provider - Reown AppKit (formerly Web3Modal)
 * 
 * Replaces Privy for authentication (Wallet, Email, Socials).
 * Uses Wagmi Adapter for blockchain interaction.
 */

'use client';

import { createAppKit } from '@reown/appkit/react';
import { WagmiProvider } from 'wagmi';
import { bsc, bscTestnet } from '@reown/appkit/networks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { ReactNode } from 'react';

// 0. Setup QueryClient
const queryClient = new QueryClient();

// 1. Get Project ID
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'c0fec440183577d33d93427181005a74';

import { type AppKitNetwork } from '@reown/appkit/networks';

// 2. Create Wagmi Adapter
export const networks = [bsc, bscTestnet] as [AppKitNetwork, ...AppKitNetwork[]];

const wagmiAdapter = new WagmiAdapter({
    networks,
    projectId,
    ssr: true
});

// 3. Create Metadata
const metadata = {
    name: 'OPoll',
    description: 'OPoll Prediction Market',
    url: 'https://opoll.org', // origin must match your domain & subdomain
    icons: ['https://opoll.org/logo.png']
};

// 4. Create AppKit
createAppKit({
    adapters: [wagmiAdapter],
    networks,
    projectId,
    metadata,
    features: {
        analytics: true, // Optional - defaults to your Cloud configuration
        email: true, // default to true
        socials: ['google', 'x', 'github', 'discord', 'apple'],
        emailShowWallets: true, // show wallets on email login (optional)
    },
    themeMode: 'dark',
    themeVariables: {
        '--w3m-accent': '#00E0FF',
        '--w3m-border-radius-master': '1px'
    }
});

interface Web3ProviderProps {
    children: ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps) {
    return (
        <WagmiProvider config={wagmiAdapter.wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </WagmiProvider>
    );
}
