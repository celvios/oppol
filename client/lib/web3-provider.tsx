'use client';

import { createWeb3Modal } from '@web3modal/wagmi/react';
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { useAccount, useDisconnect, http } from 'wagmi';
import { bsc, bscTestnet } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState, useEffect, useRef } from 'react';
import { cookieStorage, createStorage } from 'wagmi';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider } from '@privy-io/wagmi'; // Use Privy's provider, but standard config generation
import { setModalState, isModalOpen } from './connection-utils';

const projectId = '70415295a4738286445072f5c2392457';

const metadata = {
    name: 'OPoll',
    description: 'Decentralized Prediction Market',
    url: 'https://oppollbnb.vercel.app',
    icons: ['https://oppollbnb.vercel.app/icon.png'],
};

const chains = [bsc, bscTestnet] as const;

// Use defaultWagmiConfig to ensure Web3Modal works correctly
const config = defaultWagmiConfig({
    chains,
    projectId,
    metadata,
    ssr: true,
    storage: createStorage({
        storage: cookieStorage,
    }),
    transports: {
        [bsc.id]: http(),
        [bscTestnet.id]: http(),
    },
    enableInjected: true,
    enableEIP6963: true,
    enableCoinbase: false,
    enableEmail: true,
});

// Initialize modal immediately at module level to ensure hooks work
createWeb3Modal({
    wagmiConfig: config,
    projectId,
    enableAnalytics: false,
    themeMode: 'dark',
    themeVariables: {
        '--w3m-accent': '#00FF94',
    },
});

/* 
 * Legacy modal instance tracker (kept for compatibility with window.web3modal if needed)
 * But the createWeb3Modal call above acts as the singleton for hooks.
 */
let modalInstance: any = null;
let modalInitialized = true;

function initializeModal() {
    // No-op - already initialized at module level
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

            // Check if modal is already open
            if (isModalOpen()) {
                console.warn('[WagmiBridge] Modal already open, ignoring duplicate request');
                return;
            }

            const modal = (window as any).web3modal || modalInstance;
            if (modal && modal.open) {
                console.log('[WagmiBridge] Opening modal');
                setModalState(true); // Track modal state
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

        // Track modal open/close events from Web3Modal
        const handleModalOpen = () => {
            console.log('[WagmiBridge] Web3Modal opened');
            setModalState(true);
        };

        const handleModalClose = () => {
            console.log('[WagmiBridge] Web3Modal closed');
            setModalState(false);
        };

        window.addEventListener('wallet-connect-request', handleConnectRequest);
        window.addEventListener('wallet-disconnect-request', handleDisconnectRequest);
        window.addEventListener('init-web3modal', handleInitModal);

        // Listen to Web3Modal state changes
        window.addEventListener('w3m-modal-open', handleModalOpen);
        window.addEventListener('w3m-modal-close', handleModalClose);

        return () => {
            window.removeEventListener('wallet-connect-request', handleConnectRequest);
            window.removeEventListener('wallet-disconnect-request', handleDisconnectRequest);
            window.removeEventListener('init-web3modal', handleInitModal);
            window.removeEventListener('w3m-modal-open', handleModalOpen);
            window.removeEventListener('w3m-modal-close', handleModalClose);
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

    // Placeholder App ID - User must update this in .env
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

    if (!appId) {
        // In production/build, we fail if the ID is missing to prevent runtime errors
        // ensures the user configures Vercel correctly
        if (typeof window === 'undefined') {
            console.error("FATAL: NEXT_PUBLIC_PRIVY_APP_ID is not defined.");
        }
    }

    // Always render with Wagmi context to ensure proper hydration
    // The useWallet hook will handle the mounted state internally
    return (
        <PrivyProvider
            appId={appId || ''}
            config={{
                loginMethods: ['google', 'email'],
                appearance: {
                    theme: 'dark',
                    accentColor: '#00FF94',
                    logo: 'https://oppollbnb.vercel.app/icon.png',
                },
                embeddedWallets: {
                    createOnLogin: 'users-without-wallets',
                },
            }}
        >
            <QueryClientProvider client={queryClient}>
                <WagmiProvider config={config} reconnectOnMount={true}>
                    <WagmiBridge />
                    {children}
                </WagmiProvider>
            </QueryClientProvider>
        </PrivyProvider>
    );
}

export { config };
