'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { OKXUniversalProvider } from '@okxconnect/universal-provider';

interface WalletContextType {
    address: string | null;
    isConnected: boolean;
    isConnecting: boolean;
    chainId: number | null;
    connect: (walletType: 'okx' | 'coinbase' | 'binance') => Promise<void>;
    disconnect: () => void;
    signer: JsonRpcSigner | null;
}

const WalletContext = createContext<WalletContextType>({
    address: null,
    isConnected: false,
    isConnecting: false,
    chainId: null,
    connect: async () => {},
    disconnect: () => {},
    signer: null,
});

let okxProvider: any = null;

const isMobile = () => typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export function WalletProvider({ children }: { children: ReactNode }) {
    const [address, setAddress] = useState<string | null>(null);
    const [chainId, setChainId] = useState<number | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [signer, setSigner] = useState<JsonRpcSigner | null>(null);

    const BSC_TESTNET_CHAIN_ID = '0x61';

    useEffect(() => {
        const savedAddress = localStorage.getItem('wallet_address');
        const savedWallet = localStorage.getItem('wallet_type');
        if (savedAddress && savedWallet === 'okx') {
            if (isMobile()) {
                reconnectOKXMobile();
            } else {
                reconnectOKXDesktop();
            }
        }
    }, []);

    async function reconnectOKXMobile() {
        try {
            if (!okxProvider) {
                okxProvider = await OKXUniversalProvider.init({
                    dappMetaData: {
                        name: 'OPOLL',
                        icon: window.location.origin + '/favicon.ico'
                    }
                });
            }
            
            if (okxProvider.connected) {
                const session = okxProvider.session;
                const accounts = session?.namespaces?.eip155?.accounts || [];
                if (accounts.length > 0) {
                    const addr = accounts[0].split(':')[2];
                    setAddress(addr);
                    setChainId(97);
                    const ethersProvider = new BrowserProvider(okxProvider);
                    const signer = await ethersProvider.getSigner();
                    setSigner(signer);
                }
            }
        } catch (error) {
            console.error('Reconnect failed:', error);
            localStorage.removeItem('wallet_address');
            localStorage.removeItem('wallet_type');
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
        if (!okxProvider) {
            okxProvider = await OKXUniversalProvider.init({
                dappMetaData: {
                    name: 'OPOLL',
                    icon: window.location.origin + '/favicon.ico'
                }
            });
        }

        const session = await okxProvider.connect({
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
                
                const ethersProvider = new BrowserProvider(okxProvider);
                const signer = await ethersProvider.getSigner();
                setSigner(signer);
                
                localStorage.setItem('wallet_address', addr);
                localStorage.setItem('wallet_type', 'okx');
            }
        }
    }

    async function connect(walletType: 'okx' | 'coinbase' | 'binance') {
        setIsConnecting(true);
        try {
            if (walletType === 'okx') {
                if (isMobile()) {
                    await connectOKXMobile();
                } else {
                    await connectOKXDesktop();
                }
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
