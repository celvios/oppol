'use client';

import { useState, useEffect, useCallback } from 'react';
import { MetaMaskSDK } from '@metamask/sdk';

// EIP-6963 Types
interface EIP6963ProviderInfo {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
}

interface EIP1193Provider {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
}

interface EIP6963ProviderDetail {
    info: EIP6963ProviderInfo;
    provider: EIP1193Provider;
}

interface EIP6963AnnounceProviderEvent extends Event {
    detail: EIP6963ProviderDetail;
}

export interface DetectedWallet {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
    provider: EIP1193Provider;
}

interface WalletState {
    address: string | null;
    chainId: string | null;
    isConnected: boolean;
    provider: EIP1193Provider | null;
    walletName: string | null;
}

// MetaMask SDK instance (singleton)
let metamaskSDK: MetaMaskSDK | null = null;

const getMetaMaskSDK = () => {
    if (!metamaskSDK && typeof window !== 'undefined') {
        metamaskSDK = new MetaMaskSDK({
            dappMetadata: {
                name: 'OPoll Prediction Market',
                url: typeof window !== 'undefined' ? window.location.origin : '',
            },
            preferDesktop: false,
            checkInstallationImmediately: false,
            logging: {
                developerMode: false,
            },
        });
    }
    return metamaskSDK;
};

export function useEIP6963() {
    const [wallets, setWallets] = useState<DetectedWallet[]>([]);
    const [walletState, setWalletState] = useState<WalletState>({
        address: null,
        chainId: null,
        isConnected: false,
        provider: null,
        walletName: null,
    });
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Discover wallets via EIP-6963
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const detectedWallets: Map<string, DetectedWallet> = new Map();

        const handleAnnouncement = (event: Event) => {
            const e = event as EIP6963AnnounceProviderEvent;
            const { info, provider } = e.detail;

            if (!detectedWallets.has(info.uuid)) {
                detectedWallets.set(info.uuid, {
                    uuid: info.uuid,
                    name: info.name,
                    icon: info.icon,
                    rdns: info.rdns,
                    provider,
                });
                setWallets(Array.from(detectedWallets.values()));
            }
        };

        window.addEventListener('eip6963:announceProvider', handleAnnouncement);

        // Request providers to announce themselves
        window.dispatchEvent(new Event('eip6963:requestProvider'));

        // Legacy fallback: Check window.ethereum after a short delay
        setTimeout(() => {
            if (detectedWallets.size === 0 && (window as any).ethereum) {
                const ethereum = (window as any).ethereum;
                const legacyWallet: DetectedWallet = {
                    uuid: 'legacy-ethereum',
                    name: ethereum.isMetaMask ? 'MetaMask' : ethereum.isTrust ? 'Trust Wallet' : 'Browser Wallet',
                    icon: ethereum.isMetaMask
                        ? 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f6851b" width="100" height="100" rx="20"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="50">🦊</text></svg>'
                        : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%233375BB" width="100" height="100" rx="20"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="50">💎</text></svg>',
                    rdns: 'legacy.ethereum',
                    provider: ethereum,
                };
                detectedWallets.set(legacyWallet.uuid, legacyWallet);
                setWallets(Array.from(detectedWallets.values()));
            }
        }, 500);

        return () => {
            window.removeEventListener('eip6963:announceProvider', handleAnnouncement);
        };
    }, []);

    // Account change handler
    const handleAccountsChanged = useCallback((accounts: unknown) => {
        const accs = accounts as string[];
        if (accs.length === 0) {
            setWalletState({
                address: null,
                chainId: null,
                isConnected: false,
                provider: null,
                walletName: null,
            });
        } else {
            setWalletState(prev => ({
                ...prev,
                address: accs[0],
                isConnected: true,
            }));
        }
    }, []);

    // Chain change handler
    const handleChainChanged = useCallback((chainId: unknown) => {
        setWalletState(prev => ({
            ...prev,
            chainId: chainId as string,
        }));
    }, []);

    // Connect to a specific wallet
    const connect = useCallback(async (wallet: DetectedWallet) => {
        setIsConnecting(true);
        setError(null);

        try {
            const accounts = await wallet.provider.request({
                method: 'eth_requestAccounts',
            }) as string[];

            const chainId = await wallet.provider.request({
                method: 'eth_chainId',
            }) as string;

            // Set up listeners
            wallet.provider.on('accountsChanged', handleAccountsChanged);
            wallet.provider.on('chainChanged', handleChainChanged);

            setWalletState({
                address: accounts[0],
                chainId,
                isConnected: true,
                provider: wallet.provider,
                walletName: wallet.name,
            });

            // Store connection info
            if (typeof window !== 'undefined') {
                localStorage.setItem('connected_wallet_uuid', wallet.uuid);
                localStorage.setItem('connected_wallet_name', wallet.name);
            }

            return accounts[0];
        } catch (err: any) {
            console.error('Wallet connection failed:', err);
            setError(err.message || 'Failed to connect wallet');
            throw err;
        } finally {
            setIsConnecting(false);
        }
    }, [handleAccountsChanged, handleChainChanged]);

    // Connect via MetaMask SDK (for mobile)
    const connectMetaMaskSDK = useCallback(async () => {
        setIsConnecting(true);
        setError(null);

        try {
            const sdk = getMetaMaskSDK();
            if (!sdk) throw new Error('MetaMask SDK not available');

            await sdk.connect();
            const provider = sdk.getProvider();
            if (!provider) throw new Error('No provider from SDK');

            const accounts = await provider.request({
                method: 'eth_requestAccounts',
            }) as string[];

            const chainId = await provider.request({
                method: 'eth_chainId',
            }) as string;

            // Set up listeners
            provider.on('accountsChanged', handleAccountsChanged);
            provider.on('chainChanged', handleChainChanged);

            setWalletState({
                address: accounts[0],
                chainId,
                isConnected: true,
                provider: provider as EIP1193Provider,
                walletName: 'MetaMask',
            });

            localStorage.setItem('connected_wallet_uuid', 'metamask-sdk');
            localStorage.setItem('connected_wallet_name', 'MetaMask');

            return accounts[0];
        } catch (err: any) {
            console.error('MetaMask SDK connection failed:', err);
            setError(err.message || 'Failed to connect MetaMask');
            throw err;
        } finally {
            setIsConnecting(false);
        }
    }, [handleAccountsChanged, handleChainChanged]);

    // Disconnect
    const disconnect = useCallback(() => {
        if (walletState.provider) {
            walletState.provider.removeListener('accountsChanged', handleAccountsChanged);
            walletState.provider.removeListener('chainChanged', handleChainChanged);
        }

        setWalletState({
            address: null,
            chainId: null,
            isConnected: false,
            provider: null,
            walletName: null,
        });

        localStorage.removeItem('connected_wallet_uuid');
        localStorage.removeItem('connected_wallet_name');
    }, [walletState.provider, handleAccountsChanged, handleChainChanged]);

    // Switch to BSC Testnet
    const switchToBSCTestnet = useCallback(async () => {
        if (!walletState.provider) return;

        const BSC_TESTNET_CHAIN_ID = '0x61'; // 97 in hex

        try {
            await walletState.provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: BSC_TESTNET_CHAIN_ID }],
            });
        } catch (switchError: any) {
            // Chain not added, try to add it
            if (switchError.code === 4902) {
                await walletState.provider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: BSC_TESTNET_CHAIN_ID,
                        chainName: 'BSC Testnet',
                        nativeCurrency: {
                            name: 'BNB',
                            symbol: 'tBNB',
                            decimals: 18,
                        },
                        rpcUrls: ['https://bsc-testnet-rpc.publicnode.com'],
                        blockExplorerUrls: ['https://testnet.bscscan.com'],
                    }],
                });
            } else {
                throw switchError;
            }
        }
    }, [walletState.provider]);

    // Check if on mobile
    const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    return {
        wallets,
        walletState,
        isConnecting,
        error,
        connect,
        connectMetaMaskSDK,
        disconnect,
        switchToBSCTestnet,
        isMobile,
    };
}
