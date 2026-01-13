'use client';

import { useEffect, useState } from 'react';

export function WalletDebug() {
    const [providers, setProviders] = useState<any>({});

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const info: any = {
                hasOkxWallet: !!(window as any).okxwallet,
                hasEthereum: !!(window as any).ethereum,
                ethereumIsOkx: !!(window as any).ethereum?.isOkxWallet,
                ethereumIsCoinbase: !!(window as any).ethereum?.isCoinbaseWallet,
                hasBinance: !!(window as any).BinanceChain,
                hasCoinbaseExt: !!(window as any).coinbaseWalletExtension,
                userAgent: navigator.userAgent,
            };
            
            if ((window as any).ethereum) {
                info.ethereumKeys = Object.keys((window as any).ethereum).filter(k => k.startsWith('is'));
            }
            
            setProviders(info);
        }
    }, []);

    return (
        <div className="fixed bottom-20 left-4 right-4 bg-black/90 border border-white/20 rounded-lg p-4 text-xs text-white font-mono max-h-96 overflow-auto z-50">
            <h3 className="font-bold mb-2">Wallet Debug Info:</h3>
            <pre>{JSON.stringify(providers, null, 2)}</pre>
        </div>
    );
}
