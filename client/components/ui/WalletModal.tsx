'use client';

import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

interface WalletModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectWallet: (wallet: 'okx' | 'coinbase' | 'binance') => void;
}

const WALLETS = [
    {
        id: 'okx' as const,
        name: 'OKX Wallet',
        icon: 'https://static.okx.com/cdn/assets/imgs/247/58E63FEA47A2B7D7.png',
        downloadUrl: 'https://www.okx.com/web3',
        detector: () => typeof window !== 'undefined' && !!(window as any).okxwallet,
    },
    {
        id: 'coinbase' as const,
        name: 'Coinbase Wallet',
        icon: 'https://avatars.githubusercontent.com/u/18060234?s=200&v=4',
        downloadUrl: 'https://www.coinbase.com/wallet',
        detector: () => typeof window !== 'undefined' && !!((window as any).coinbaseWalletExtension || (window as any).ethereum?.isCoinbaseWallet),
    },
    {
        id: 'binance' as const,
        name: 'Binance Wallet',
        icon: 'https://bin.bnbstatic.com/static/images/common/favicon.ico',
        downloadUrl: 'https://www.binance.com/en/web3wallet',
        detector: () => typeof window !== 'undefined' && !!(window as any).BinanceChain,
    },
];

export function WalletModal({ isOpen, onClose, onSelectWallet }: WalletModalProps) {
    const [installedWallets, setInstalledWallets] = useState<Record<string, boolean>>({});
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            const installed: Record<string, boolean> = {};
            WALLETS.forEach(wallet => {
                installed[wallet.id] = wallet.detector();
            });
            setInstalledWallets(installed);
            setError(null);
        }
    }, [isOpen]);

    const handleWalletClick = async (wallet: typeof WALLETS[0]) => {
        if (!installedWallets[wallet.id]) {
            setError(`${wallet.name} is not installed. Please install it first.`);
            setTimeout(() => {
                window.open(wallet.downloadUrl, '_blank');
            }, 1500);
            return;
        }
        
        try {
            await onSelectWallet(wallet.id);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to connect wallet');
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="relative bg-surface border border-white/10 rounded-2xl p-6 max-w-md w-full"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-white">Connect Wallet</h2>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-white/50" />
                            </button>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <p className="text-red-400 text-sm">{error}</p>
                            </div>
                        )}

                        <div className="space-y-3">
                            {WALLETS.map((wallet) => {
                                const isInstalled = installedWallets[wallet.id];
                                return (
                                    <button
                                        key={wallet.id}
                                        onClick={() => handleWalletClick(wallet)}
                                        className="w-full flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all group"
                                    >
                                        <img
                                            src={wallet.icon}
                                            alt={wallet.name}
                                            className="w-10 h-10 rounded-lg"
                                        />
                                        <div className="flex-1 text-left">
                                            <span className="text-white font-medium text-lg block">{wallet.name}</span>
                                            {!isInstalled && (
                                                <span className="text-xs text-orange-400">Not installed - Click to download</span>
                                            )}
                                        </div>
                                        <div className="ml-auto text-white/50 group-hover:text-white transition-colors">
                                            {isInstalled ? '→' : '↗'}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <p className="text-white/40 text-xs text-center mt-6">
                            New to Web3? Install a wallet extension to get started.
                        </p>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
