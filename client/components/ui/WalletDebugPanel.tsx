"use client";

import { useWallet } from "@/lib/use-wallet";
import { useAccount } from "wagmi";
import { useState, useEffect } from "react";
import { X, Bug } from "lucide-react";

export function WalletDebugPanel() {
    const [isOpen, setIsOpen] = useState(false);
    const [events, setEvents] = useState<string[]>([]);
    const wallet = useWallet();

    // Only show in development
    const isDev = process.env.NODE_ENV === 'development';

    let wagmiAccount: any = { address: undefined, isConnected: false };
    try {
        if (typeof window !== 'undefined') {
            wagmiAccount = useAccount();
        }
    } catch (e) {
        // Wagmi not available
    }

    useEffect(() => {
        if (!isDev) return;

        const handleWalletEvent = (e: CustomEvent) => {
            const timestamp = new Date().toLocaleTimeString();
            const detail = JSON.stringify(e.detail);
            setEvents(prev => [...prev.slice(-9), `${timestamp}: ${e.type} - ${detail}`]);
        };

        window.addEventListener('wallet-changed', handleWalletEvent as EventListener);
        window.addEventListener('wallet-connect-request', handleWalletEvent as EventListener);
        window.addEventListener('wallet-disconnect-request', handleWalletEvent as EventListener);

        return () => {
            window.removeEventListener('wallet-changed', handleWalletEvent as EventListener);
            window.removeEventListener('wallet-connect-request', handleWalletEvent as EventListener);
            window.removeEventListener('wallet-disconnect-request', handleWalletEvent as EventListener);
        };
    }, [isDev]);

    if (!isDev) return null;

    return (
        <>
            {/* Debug Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-4 right-4 z-50 p-3 bg-purple-600 hover:bg-purple-700 rounded-full shadow-lg transition-colors"
                title="Wallet Debug Panel"
            >
                <Bug size={20} className="text-white" />
            </button>

            {/* Debug Panel */}
            {isOpen && (
                <div className="fixed bottom-20 right-4 z-50 w-96 max-h-96 bg-black/90 border border-purple-500/50 rounded-lg p-4 text-xs text-white font-mono overflow-y-auto">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-purple-400 font-bold">Wallet Debug</h3>
                        <button onClick={() => setIsOpen(false)}>
                            <X size={16} className="text-white/60 hover:text-white" />
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <div className="text-purple-400 mb-1">useWallet Hook:</div>
                            <div className="pl-2 space-y-1">
                                <div>Connected: {wallet.isConnected ? '✅' : '❌'}</div>
                                <div>Address: {wallet.address || 'null'}</div>
                                <div>Connecting: {wallet.isConnecting ? '⏳' : '✅'}</div>
                            </div>
                        </div>

                        <div>
                            <div className="text-purple-400 mb-1">Wagmi Direct:</div>
                            <div className="pl-2 space-y-1">
                                <div>Connected: {wagmiAccount.isConnected ? '✅' : '❌'}</div>
                                <div>Address: {wagmiAccount.address || 'null'}</div>
                            </div>
                        </div>

                        <div>
                            <div className="text-purple-400 mb-1">Web3Modal:</div>
                            <div className="pl-2">
                                Available: {(window as any).web3modal ? '✅' : '❌'}
                            </div>
                        </div>

                        <div>
                            <div className="text-purple-400 mb-1">Local Storage:</div>
                            <div className="pl-2">
                                <div>State: {localStorage.getItem('opoll-wallet-state') || 'null'}</div>
                                <div>Timestamp: {localStorage.getItem('opoll-wallet-timestamp') || 'null'}</div>
                            </div>
                        </div>

                        <div>
                            <div className="text-purple-400 mb-1">Recent Events:</div>
                            <div className="pl-2 space-y-1 max-h-32 overflow-y-auto">
                                {events.length === 0 ? (
                                    <div className="text-white/50">No events yet</div>
                                ) : (
                                    events.map((event, i) => (
                                        <div key={i} className="text-xs break-all">{event}</div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="pt-2 border-t border-purple-500/30">
                            <button
                                onClick={() => {
                                    localStorage.removeItem('opoll-wallet-state');
                                    localStorage.removeItem('opoll-wallet-timestamp');
                                    setEvents([]);
                                }}
                                className="text-red-400 hover:text-red-300 text-xs"
                            >
                                Clear Storage & Events
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}