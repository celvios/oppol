'use client';

import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { useWallet } from './use-wallet';

interface WalletContextType {
    isConnected: boolean;
    address: string | null;
    isConnecting: boolean;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    // Add debug info
    _debug?: {
        contextSource: string;
        lastUpdate: number;
    };
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
    const wallet = useWallet();
    const [lastUpdate, setLastUpdate] = useState(Date.now());
    
    // Track when wallet state changes
    useEffect(() => {
        setLastUpdate(Date.now());
        console.log('[WalletProvider] State updated:', wallet);
    }, [wallet.isConnected, wallet.address]);
    
    const contextValue: WalletContextType = {
        ...wallet,
        _debug: {
            contextSource: 'WalletProvider',
            lastUpdate
        }
    };
    
    return (
        <WalletContext.Provider value={contextValue}>
            {children}
        </WalletContext.Provider>
    );
}

export function useWalletContext() {
    const context = useContext(WalletContext);
    const fallbackWallet = useWallet();
    
    if (context) {
        console.log('[useWalletContext] Using context:', context._debug);
        return context;
    }
    
    console.log('[useWalletContext] Using fallback wallet');
    return {
        ...fallbackWallet,
        _debug: {
            contextSource: 'fallback',
            lastUpdate: Date.now()
        }
    };
}
