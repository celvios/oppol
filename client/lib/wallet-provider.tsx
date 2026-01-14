'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { OKXUniversalProvider } from '@okxconnect/universal-provider';

interface WalletContextType {
    address: string | null;
    isConnected: boolean;
    isConnecting: boolean;
    chainId: number | null;
    connect: (walletType: 'okx' | 'coinbase' | 'binance' | 'metamask' | 'trustwallet' | 'walletconnect') => Promise<void>;
    disconnect: () => void;
    signer: JsonRpcSigner | null;
}

const WalletContext = createContext<WalletContextType>({
    address: null,
    isConnected: false,
    isConnecting: false,
    chainId: null,
    connect: async () => { },
    disconnect: () => { },
    signer: null,
});

let okxProvider: any = null;
let wcProvider: any = null;
let isInitializing = false;

const isMobile = () => typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

async function getOKXProvider() {
    if (okxProvider) return okxProvider;
    if (isInitializing) {
        // Wait for initialization to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        return getOKXProvider();
    }

    isInitializing = true;
    try {
        okxProvider = await OKXUniversalProvider.init({
            dappMetaData: {
                name: 'OPOLL',
                icon: typeof window !== 'undefined' ? window.location.origin + '/favicon.ico' : ''
            }
        });
        return okxProvider;
    } finally {
        isInitializing = false;
    }
}

export function WalletProvider({ children }: { children: ReactNode }) {
    const [address, setAddress] = useState<string | null>(null);
    const [chainId, setChainId] = useState<number | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [signer, setSigner] = useState<JsonRpcSigner | null>(null);

    const BSC_TESTNET_CHAIN_ID = '0x61';

    useEffect(() => {
        const savedAddress = localStorage.getItem('wallet_address');
        const savedWallet = localStorage.getItem('wallet_type');

        // Set address immediately from localStorage for instant UI update
        if (savedAddress) {
            setAddress(savedAddress);
        }

        if (savedAddress && savedWallet) {
            if (savedWallet === 'okx') {
                if (isMobile()) {
                    reconnectOKXMobile();
                } else {
                    reconnectOKXDesktop();
                }
            } else if (savedWallet === 'walletconnect') {
                reconnectWalletConnect();
            } else {
                reconnectBrowserWallet(savedWallet as 'coinbase' | 'binance' | 'metamask' | 'trustwallet');
            }
        }
    }, []);

    async function reconnectWalletConnect() {
        try {
            const provider = await getOKXProvider();
            if (provider.connected) {
                const session = provider.session;
                const accounts = session?.namespaces?.eip155?.accounts || [];
                if (accounts.length > 0) {
                    const addr = accounts[0].split(':')[2];
                    setAddress(addr);
                    setChainId(97);
                    const ethersProvider = new BrowserProvider(provider);
                    const signer = await ethersProvider.getSigner();
                    setSigner(signer);
                } else {
                    localStorage.removeItem('wallet_address');
                    localStorage.removeItem('wallet_type');
                    setAddress(null);
                }
            } else {
                localStorage.removeItem('wallet_address');
                localStorage.removeItem('wallet_type');
                setAddress(null);
            }
        } catch (error) {
            console.error('Reconnect failed:', error);
            localStorage.removeItem('wallet_address');
            localStorage.removeItem('wallet_type');
            setAddress(null);
        }
    }

    async function reconnectOKXMobile() {
        try {
            const provider = await getOKXProvider();

            if (provider.connected) {
                const session = provider.session;
                const accounts = session?.namespaces?.eip155?.accounts || [];
                if (accounts.length > 0) {
                    const addr = accounts[0].split(':')[2];
                    setAddress(addr);
                    setChainId(97);
                    const ethersProvider = new BrowserProvider(provider);
                    const signer = await ethersProvider.getSigner();
                    setSigner(signer);
                } else {
                    // Session exists but no accounts, clear storage
                    localStorage.removeItem('wallet_address');
                    localStorage.removeItem('wallet_type');
                    setAddress(null);
                }
            } else {
                // Not connected, clear storage
                localStorage.removeItem('wallet_address');
                localStorage.removeItem('wallet_type');
                setAddress(null);
            }
        } catch (error) {
            console.error('Reconnect failed:', error);
            localStorage.removeItem('wallet_address');
            localStorage.removeItem('wallet_type');
            setAddress(null);
        }
    }

    async function reconnectOKXDesktop() {
        try {
            const provider = (window as any).okxwallet;
            if (!provider) return;

            const ethersProvider = new BrowserProvider(provider);
            const accounts = await ethersProvider.listAccounts();
            if (accounts.length > 0) {
                setAddress(accounts[0].address);
                const network = await ethersProvider.getNetwork();
                setChainId(Number(network.chainId));
                const signer = await ethersProvider.getSigner();
                setSigner(signer);
            }
        } catch (error) {
            console.error('Reconnect failed:', error);
            localStorage.removeItem('wallet_address');
            localStorage.removeItem('wallet_type');
        }
    }

    async function reconnectBrowserWallet(walletType: 'coinbase' | 'binance' | 'metamask' | 'trustwallet') {
        try {
            let provider;
            if (walletType === 'coinbase') {
                provider = (window as any).coinbaseWalletExtension || (window as any).ethereum;
            } else if (walletType === 'binance') {
                provider = (window as any).BinanceChain;
            } else if (walletType === 'metamask') {
                provider = (window as any).ethereum;
            } else if (walletType === 'trustwallet') {
                provider = (window as any).trustwallet || (window as any).ethereum;
            }

            if (!provider) return;

            const ethersProvider = new BrowserProvider(provider);
            const accounts = await ethersProvider.listAccounts();
            if (accounts.length > 0) {
                setAddress(accounts[0].address);
                const network = await ethersProvider.getNetwork();
                setChainId(Number(network.chainId));
                const signer = await ethersProvider.getSigner();
                setSigner(signer);
            }
        } catch (error) {
            console.error('Reconnect failed:', error);
            localStorage.removeItem('wallet_address');
            localStorage.removeItem('wallet_type');
        }
    }

    async function switchToBSC(provider: any) {
        try {
            await provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: BSC_TESTNET_CHAIN_ID }],
            });
        } catch (error: any) {
            if (error.code === 4902) {
                await provider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: BSC_TESTNET_CHAIN_ID,
                        chainName: 'BNB Smart Chain Testnet',
                        nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                        rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
                        blockExplorerUrls: ['https://testnet.bscscan.com'],
                    }],
                });
            }
        }
    }

    async function connectOKXDesktop() {
        const provider = (window as any).okxwallet;
        if (!provider) {
            throw new Error('OKX Wallet extension not found. Please install it from okx.com/web3');
        }

        const ethersProvider = new BrowserProvider(provider);
        const accounts = await ethersProvider.send('eth_requestAccounts', []);

        await switchToBSC(provider);

        const network = await ethersProvider.getNetwork();
        const signer = await ethersProvider.getSigner();

        setAddress(accounts[0]);
        setChainId(Number(network.chainId));
        setSigner(signer);

        localStorage.setItem('wallet_address', accounts[0]);
        localStorage.setItem('wallet_type', 'okx');

        provider.on?.('accountsChanged', (accounts: string[]) => {
            if (accounts.length === 0) {
                disconnect();
            } else {
                setAddress(accounts[0]);
                localStorage.setItem('wallet_address', accounts[0]);
            }
        });

        provider.on?.('chainChanged', () => {
            window.location.reload();
        });
    }

    async function connectOKXMobile() {
        const provider = await getOKXProvider();

        const session = await provider.connect({
            namespaces: {
                eip155: {
                    chains: ['eip155:97'],
                    methods: ['eth_sendTransaction', 'eth_signTransaction', 'eth_sign', 'personal_sign', 'eth_signTypedData'],
                    events: ['chainChanged', 'accountsChanged'],
                    rpcMap: {
                        97: 'https://data-seed-prebsc-1-s1.binance.org:8545/'
                    }
                }
            },
            optionalNamespaces: {
                eip155: {
                    chains: ['eip155:56'],
                    methods: ['eth_sendTransaction', 'eth_signTransaction', 'eth_sign', 'personal_sign', 'eth_signTypedData'],
                    events: ['chainChanged', 'accountsChanged'],
                    rpcMap: {
                        56: 'https://bsc-dataseed.binance.org/'
                    }
                }
            },
            sessionConfig: {
                redirect: 'none'
            }
        });

        if (session) {
            const accounts = session.namespaces.eip155?.accounts || [];
            if (accounts.length > 0) {
                const addr = accounts[0].split(':')[2];
                setAddress(addr);
                setChainId(97);

                const ethersProvider = new BrowserProvider(provider);
                const signer = await ethersProvider.getSigner();
                setSigner(signer);

                localStorage.setItem('wallet_address', addr);
                localStorage.setItem('wallet_type', 'okx');
            }
        }
    }

    async function connectBrowserWallet(walletType: 'coinbase' | 'binance' | 'metamask' | 'trustwallet') {
        const walletNames: Record<string, string> = {
            coinbase: 'Coinbase',
            binance: 'Binance',
            metamask: 'MetaMask',
            trustwallet: 'Trust Wallet'
        };

        // Mobile deep linking - redirect to wallet app's browser
        if (isMobile()) {
            const currentUrl = encodeURIComponent(window.location.href);

            if (walletType === 'metamask') {
                // Check if we're already in MetaMask browser
                if ((window as any).ethereum?.isMetaMask) {
                    // We're in MetaMask browser, proceed with connection
                } else {
                    // Redirect to MetaMask deep link
                    window.location.href = `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;
                    return;
                }
            } else if (walletType === 'trustwallet') {
                // Check if we're already in Trust Wallet browser
                if ((window as any).trustwallet || (window as any).ethereum?.isTrust) {
                    // We're in Trust Wallet browser, proceed with connection
                } else {
                    // Redirect to Trust Wallet deep link
                    window.location.href = `https://link.trustwallet.com/open_url?coin_id=60&url=${currentUrl}`;
                    return;
                }
            }
        }

        let provider;
        if (walletType === 'coinbase') {
            provider = (window as any).coinbaseWalletExtension || (window as any).ethereum;
        } else if (walletType === 'binance') {
            provider = (window as any).BinanceChain;
        } else if (walletType === 'metamask') {
            // For MetaMask, specifically check for MetaMask provider
            const ethereum = (window as any).ethereum;
            if (ethereum?.providers?.length) {
                // Multiple providers (e.g., MetaMask + Coinbase), find MetaMask
                provider = ethereum.providers.find((p: any) => p.isMetaMask);
            } else if (ethereum?.isMetaMask) {
                provider = ethereum;
            }
        } else if (walletType === 'trustwallet') {
            provider = (window as any).trustwallet || (window as any).ethereum;
        }

        if (!provider) {
            throw new Error(`${walletNames[walletType]} Wallet not found. Please install the browser extension.`);
        }

        const ethersProvider = new BrowserProvider(provider);
        const accounts = await ethersProvider.send('eth_requestAccounts', []);

        await switchToBSC(provider);

        const network = await ethersProvider.getNetwork();
        const signer = await ethersProvider.getSigner();

        setAddress(accounts[0]);
        setChainId(Number(network.chainId));
        setSigner(signer);

        localStorage.setItem('wallet_address', accounts[0]);
        localStorage.setItem('wallet_type', walletType);

        provider.on?.('accountsChanged', (accounts: string[]) => {
            if (accounts.length === 0) {
                disconnect();
            } else {
                setAddress(accounts[0]);
                localStorage.setItem('wallet_address', accounts[0]);
            }
        });

        provider.on?.('chainChanged', () => {
            window.location.reload();
        });
    }

    async function connectWalletConnect() {
        const provider = await getOKXProvider();
        const session = await provider.connect({
            namespaces: {
                eip155: {
                    chains: ['eip155:97'],
                    methods: ['eth_sendTransaction', 'eth_signTransaction', 'eth_sign', 'personal_sign', 'eth_signTypedData'],
                    events: ['chainChanged', 'accountsChanged'],
                    rpcMap: {
                        97: 'https://data-seed-prebsc-1-s1.binance.org:8545/'
                    }
                }
            },
            optionalNamespaces: {
                eip155: {
                    chains: ['eip155:56'],
                    methods: ['eth_sendTransaction', 'eth_signTransaction', 'eth_sign', 'personal_sign', 'eth_signTypedData'],
                    events: ['chainChanged', 'accountsChanged'],
                    rpcMap: {
                        56: 'https://bsc-dataseed.binance.org/'
                    }
                }
            },
            sessionConfig: {
                redirect: 'none'
            }
        });

        if (session) {
            const accounts = session.namespaces.eip155?.accounts || [];
            if (accounts.length > 0) {
                const addr = accounts[0].split(':')[2];
                setAddress(addr);
                setChainId(97);
                const ethersProvider = new BrowserProvider(provider);
                const signer = await ethersProvider.getSigner();
                setSigner(signer);
                localStorage.setItem('wallet_address', addr);
                localStorage.setItem('wallet_type', 'walletconnect');
            }
        }
    }

    async function connect(walletType: 'okx' | 'coinbase' | 'binance' | 'metamask' | 'trustwallet' | 'walletconnect') {
        setIsConnecting(true);
        try {
            if (walletType === 'okx') {
                if (isMobile()) {
                    await connectOKXMobile();
                } else {
                    await connectOKXDesktop();
                }
            } else if (walletType === 'walletconnect') {
                await connectWalletConnect();
            } else {
                await connectBrowserWallet(walletType);
            }
        } catch (error) {
            console.error('Connection failed:', error);
            throw error;
        } finally {
            setIsConnecting(false);
        }
    }

    function disconnect() {
        if (okxProvider) {
            okxProvider.disconnect();
        }
        setAddress(null);
        setChainId(null);
        setSigner(null);
        localStorage.removeItem('wallet_address');
        localStorage.removeItem('wallet_type');
    }

    return (
        <WalletContext.Provider value={{
            address,
            isConnected: !!address,
            isConnecting,
            chainId,
            connect,
            disconnect,
            signer,
        }}>
            {children}
        </WalletContext.Provider>
    );
}

export function useWalletContext() {
    return useContext(WalletContext);
}
