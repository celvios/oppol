'use client';

import { createWeb3Modal } from '@web3modal/wagmi/react';
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { WagmiProvider, useAccount, useDisconnect } from 'wagmi';
import { bsc, bscTestnet } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState, useEffect, useRef } from 'react';
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

// Global modal instance tracker
let modalInstance: any = null;
let modalInitialized = false;

function initializeModal() {
    if (!modalInitialized && typeof window !== 'undefined') {
        console.log('[Web3Provider] Initializing Web3Modal');

        try {
            modalInstance = createWeb3Modal({
                wagmiConfig: config,
                projectId,
                enableAnalytics: false,
                themeMode: 'dark',
                themeVariables: {
                    '--w3m-accent': '#00FF94',
                },
            });

            // Store modal instance on window for global access
            (window as any).web3modal = modalInstance;
            modalInitialized = true;

            console.log('[Web3Provider] Web3Modal initialized successfully');
        } catch (error) {
            console.error('[Web3Provider] Failed to initialize Web3Modal:', error);
        }
    }
    return modalInstance;
}

// Bridge component to sync Wagmi state with custom events
function WagmiBridge() {
    const { address, isConnected } = useAccount();
    const { disconnect } = useDisconnect();
    const lastStateRef = useRef({ address: null, isConnected: false });
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Sync Wagmi state -> Custom Events (for useWallet) with debounce
    useEffect(() => {
        const currentAddress = address || null;
        const currentConnected = isConnected;

        // Clear any pending debounce
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // If connecting, dispatch immediately (good UX)
        if (currentConnected && !lastStateRef.current.isConnected) {
            console.log('[WagmiBridge] Connection detected, dispatching immediately');
            lastStateRef.current = { address: currentAddress, isConnected: currentConnected };
            window.dispatchEvent(new CustomEvent('wallet-changed', {
                detail: { address: currentAddress, isConnected: currentConnected }
            }));
            return;
        }

        // If disconnecting, debounce to avoid flashes during navigation
        if (!currentConnected && lastStateRef.current.isConnected) {
            console.log('[WagmiBridge] Temporary disconnect detected, debouncing...');
            debounceTimerRef.current = setTimeout(() => {
                // Only dispatch if still disconnected after 500ms
                if (!isConnected) {
                    console.log('[WagmiBridge] Still disconnected after debounce, dispatching disconnect');
                    lastStateRef.current = { address: null, isConnected: false };
                    window.dispatchEvent(new CustomEvent('wallet-changed', {
                        detail: { address: null, isConnected: false }
                    }));
                } else {
                    console.log('[WagmiBridge] Reconnected during debounce, ignoring disconnect');
                }
            }, 500);
            return;
        }

        // For address changes while connected, update immediately
        if (currentAddress !== lastStateRef.current.address && currentConnected) {
            console.log('[WagmiBridge] Address changed:', {
                from: lastStateRef.current.address,
                to: currentAddress
            });
            lastStateRef.current = { address: currentAddress, isConnected: currentConnected };
            window.dispatchEvent(new CustomEvent('wallet-changed', {
                detail: { address: currentAddress, isConnected: currentConnected }
            }));
        }

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [address, isConnected]);

    // Listen for connection and initialization requests
    useEffect(() => {
        const handleConnectRequest = () => {
            console.log('[WagmiBridge] Connect request received');
            const modal = (window as any).web3modal || modalInstance;
            if (modal && modal.open) {
                console.log('[WagmiBridge] Opening modal');
                modal.open();
            } else {
                console.error('[WagmiBridge] Modal not available for connection');
            }
        };

        const handleDisconnectRequest = () => {
            console.log('[WagmiBridge] Disconnect request received');
            disconnect();
        };

        const handleInitModal = () => {
            console.log('[WagmiBridge] Modal initialization request received');
            initializeModal();
        };

        window.addEventListener('wallet-connect-request', handleConnectRequest);
        window.addEventListener('wallet-disconnect-request', handleDisconnectRequest);
        window.addEventListener('init-web3modal', handleInitModal);

        return () => {
            window.removeEventListener('wallet-connect-request', handleConnectRequest);
            window.removeEventListener('wallet-disconnect-request', handleDisconnectRequest);
            window.removeEventListener('init-web3modal', handleInitModal);
        };
    }, [disconnect]);

    return null;
}

interface Web3ProviderProps {
    children: ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps) {
    const [mounted, setMounted] = useState(false);
    const initRef = useRef(false);

    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                refetchOnWindowFocus: false,
                retry: false,
                staleTime: 30000, // 30 seconds
            },
        },
    }));

    useEffect(() => {
        if (!initRef.current) {
            console.log('[Web3Provider] Mounting and initializing');
            setMounted(true);
            initializeModal();
            initRef.current = true;
        }
    }, []);

    // Always render with Wagmi context to ensure proper hydration
    // The useWallet hook will handle the mounted state internally
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
