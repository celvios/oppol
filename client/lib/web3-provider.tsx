/**
 * Web3 Provider - Privy Only (with Wagmi)
 * 
 * Clean implementation using ONLY Privy for all wallet connections.
 * Privy requires Wagmi as a peer dependency for blockchain interactions.
 */

'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { bsc, bscTestnet } from 'wagmi/chains';
import { http, createConfig } from 'wagmi';
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors';
import { ReactNode, useState } from 'react';

const queryClient = new QueryClient();

// Wagmi config with explicit connectors for Headless usage
const config = createConfig({
    chains: [bsc, bscTestnet],
    transports: {
        [bsc.id]: http(),
        [bscTestnet.id]: http(),
    },
    connectors: [
        injected(), // Restoring explicit injected connector
        coinbaseWallet({ appName: 'OPoll' }),
        walletConnect({ projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'c0fec440183577d33d93427181005a74' }),
    ],
    ssr: true,
});

interface Web3ProviderProps {
    children: ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps) {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

    if (!appId) {
        console.error("FATAL: NEXT_PUBLIC_PRIVY_APP_ID is not defined.");
        return <>{children}</>;
    }

    return (
        <PrivyProvider
            appId={appId}
            config={{
                loginMethods: ['wallet', 'google', 'email'],
                appearance: {
                    theme: 'dark',
                    accentColor: '#00E0FF',
                    logo: '/logo.png', // Use relative path
                },
                embeddedWallets: {
                    createOnLogin: 'users-without-wallets',
                    noPromptOnSignature: false,
                },
                // Fix SIWE error
                siweConfig: {
                    domain: typeof window !== 'undefined' ? window.location.host : 'opoll.org',
                    uri: typeof window !== 'undefined' ? window.location.origin : 'https://opoll.org',
                },
            }}
        >
            <QueryClientProvider client={queryClient}>
                <WagmiProvider config={config}>
                    {children}
                </WagmiProvider>
            </QueryClientProvider>
        </PrivyProvider>
    );
}
