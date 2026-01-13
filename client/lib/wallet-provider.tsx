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
            reconnectOKX();
        }
    }, []);

    async function reconnectOKX() {
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

    async function connect(walletType: 'okx' | 'coinbase' | 'binance') {
        setIsConnecting(true);
        try {
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
