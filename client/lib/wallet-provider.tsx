'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { OKXUniversalProvider } from '@okxconnect/universal-provider';
import { CoinbaseWalletSDK } from '@coinbase/wallet-sdk';

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
let coinbaseProvider: any = null;

export function WalletProvider({ children }: { children: ReactNode }) {
    const [address, setAddress] = useState<string | null>(null);
    const [chainId, setChainId] = useState<number | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [signer, setSigner] = useState<JsonRpcSigner | null>(null);

    const BSC_TESTNET_CHAIN_ID = '0x61';

    useEffect(() => {
        const savedAddress = localStorage.getItem('wallet_address');
        const savedWallet = localStorage.getItem('wallet_type');
        if (savedAddress && savedWallet) {
            reconnect(savedWallet as any);
        }
    }, []);

    async function reconnect(walletType: 'okx' | 'coinbase' | 'binance') {
        try {
            const provider = getProvider(walletType);
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

    function getProvider(walletType: 'okx' | 'coinbase' | 'binance') {
        if (typeof window === 'undefined') return null;
        
        switch (walletType) {
            case 'okx':
                // Desktop: window.okxwallet, Mobile: window.ethereum with isOkxWallet flag
                return (window as any).okxwallet || ((window as any).ethereum?.isOkxWallet ? (window as any).ethereum : null);
            case 'coinbase':
                return (window as any).coinbaseWalletExtension || (window as any).ethereum;
            case 'binance':
                return (window as any).BinanceChain;
            default:
                return null;
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

    async function connect(walletType: 'okx' | 'coinbase' | 'binance') {
        setIsConnecting(true);
        try {
            const provider = getProvider(walletType);
            if (!provider) {
                throw new Error(`${walletType.toUpperCase()} wallet not found. Please install the browser extension.`);
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
        } catch (error) {
            console.error('Connection failed:', error);
            throw error;
        } finally {
            setIsConnecting(false);
        }
    }

    function disconnect() {
        setAddress(null);
        setChainId(null);
        setSigner(null);
        localStorage.removeItem('wallet_address');
        localStorage.removeItem('wallet_type');
        localStorage.removeItem('session_token');
        localStorage.removeItem('cached_wallet_address');
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
