'use client';

import { createWeb3Modal, useWeb3Modal } from '@web3modal/wagmi/react'; // Ensure import
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { WagmiProvider, useAccount } from 'wagmi'; // Ensure useAccount import
import { bsc, bscTestnet } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState, useEffect } from 'react';
import { cookieStorage, createStorage, cookieToInitialState } from 'wagmi';

const projectId = '70415295a4738286445072f5c2392457';

const metadata = {
    name: 'OPoll',
    description: 'Decentralized Prediction Market',
    url: 'https://oppollbnb.vercel.app',
    icons: ['https://oppollbnb.vercel.app/icon.png'],
};

const chains = [bsc, bscTestnet] as const;

const config = defaultWagmiConfig({
    chains,
    projectId,
    metadata,
    ssr: false,
    storage: createStorage({
        storage: typeof window !== 'undefined' ? window.localStorage : cookieStorage,
    }),
});

// Initialize modal outside component is fine for singleton behavior
createWeb3Modal({
    wagmiConfig: config,
    projectId,
    enableAnalytics: false,
    themeMode: 'dark',
    themeVariables: {
        '--w3m-accent': '#00FF94',
    },
});

// Bridge component to sync Wagmi state with the app's custom event system
function WagmiBridge() {
    const { open } = useWeb3Modal();
    const { address, isConnected } = useAccount();

    // Sync Wagmi state -> Custom Events (for useWallet)
    useEffect(() => {
        // Dispatch event for other components using useWallet
        window.dispatchEvent(new CustomEvent('wallet-changed', {
            detail: { address: address || null, isConnected: isConnected }
        }));

        // Update local cache for immediate hydration on reload
        if (isConnected && address) {
            localStorage.setItem('wallet_cache', JSON.stringify({ address, isConnected }));
        } else {
            localStorage.removeItem('wallet_cache');
        }
    }, [address, isConnected]);

    // Listen for connection requests -> Open Wagmi Modal
    useEffect(() => {
        const handleConnectRequest = () => {
            console.log('[WagmiBridge] Opening modal...');
            open();
        };

        window.addEventListener('wallet-connect-request', handleConnectRequest);
        return () => window.removeEventListener('wallet-connect-request', handleConnectRequest);
    }, [open]);

    return null;
}

interface Web3ProviderProps {
    children: ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps) {
    const [mounted, setMounted] = useState(false);

    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                refetchOnWindowFocus: false,
                retry: false,
            },
        },
    }));

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return null;
    }

    return (
        <WagmiProvider config={config} reconnectOnMount={true}>
            <QueryClientProvider client={queryClient}>
                <WagmiBridge />
                {children}
            </QueryClientProvider>
        </WagmiProvider>
    );
}

export { config };
