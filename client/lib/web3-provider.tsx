'use client';

import { createWeb3Modal } from '@web3modal/wagmi/react';
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { WagmiProvider, useAccount, useDisconnect } from 'wagmi';
import { bsc, bscTestnet } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState, useEffect } from 'react';
import { cookieStorage, createStorage } from 'wagmi';

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
    ssr: true,
    storage: createStorage({
        storage: cookieStorage,
    }),
});

// Track if modal has been initialized (client-side only)
let modalInitialized = false;

function initializeModal() {
    if (!modalInitialized && typeof window !== 'undefined') {
        const modal = createWeb3Modal({
            wagmiConfig: config,
            projectId,
            enableAnalytics: false,
            themeMode: 'dark',
            themeVariables: {
                '--w3m-accent': '#00FF94',
            },
        });
        // Store modal instance on window for WagmiBridge to access
        (window as any).web3modal = modal;
        modalInitialized = true;
    }
}

// Bridge component to sync Wagmi state with custom events
function WagmiBridge() {
    const { address, isConnected } = useAccount();
    const { disconnect } = useDisconnect();

    // Sync Wagmi state -> Custom Events (for useWallet)
    useEffect(() => {
        window.dispatchEvent(new CustomEvent('wallet-changed', {
            detail: { address: address || null, isConnected: isConnected }
        }));

        // Update local cache
        if (isConnected && address) {
            localStorage.setItem('wallet_cache', JSON.stringify({ address, isConnected }));
        } else {
            localStorage.removeItem('wallet_cache');
        }
    }, [address, isConnected]);

    // Listen for connection requests
    useEffect(() => {
        const handleConnectRequest = () => {
            // Access Web3Modal directly from window if available
            const modal = (window as any).web3modal;
            if (modal && modal.open) {
                modal.open();
            }
        };

        const handleDisconnectRequest = () => {
            disconnect();
        };

        window.addEventListener('wallet-connect-request', handleConnectRequest);
        window.addEventListener('wallet-disconnect-request', handleDisconnectRequest);
        return () => {
            window.removeEventListener('wallet-connect-request', handleConnectRequest);
            window.removeEventListener('wallet-disconnect-request', handleDisconnectRequest);
        };
    }, [disconnect]);

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
        initializeModal();
    }, []);

    // During SSR, render children without Wagmi context
    // useWallet will use cached state from localStorage
    if (!mounted) {
        return <>{children}</>;
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
