'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useWallet } from './use-wallet';

const WalletContext = createContext<any>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
    const wallet = useWallet();
    return (
        <WalletContext.Provider value={wallet}>
            {children}
        </WalletContext.Provider>
    );
}

export function useWalletContext() {
    return useContext(WalletContext) || useWallet();
}
