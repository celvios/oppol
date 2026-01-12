'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, Loader2 } from 'lucide-react';
import { DetectedWallet } from '@/lib/useEIP6963';
import { useWeb3Modal } from '@web3modal/wagmi/react';

interface WalletSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    wallets: DetectedWallet[];
    onSelectWallet: (wallet: DetectedWallet) => void;
    onConnectMetaMaskSDK: () => void;
    isConnecting: boolean;
    error: string | null;
    isMobile: boolean;
}

export function WalletSelectorModal({
    isOpen,
    onClose,
    wallets,
    onSelectWallet,
    onConnectMetaMaskSDK,
    isConnecting,
    error,
    isMobile,
}: WalletSelectorModalProps) {
    const { open } = useWeb3Modal();

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-surface border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
                >
                    <div className="p-6 relative">
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
                        >
                            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10">
                                <X size={16} />
                            </div>
                        </button>

                        <h2 className="text-xl font-bold text-white mb-2">Connect Wallet</h2>
                        <p className="text-white/50 text-sm mb-6">
                            Choose a wallet to connect to OPoll
                        </p>

                        {/* Error Message */}
                        {error && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                                <p className="text-red-400 text-sm">{error}</p>
                            </div>
                        )}

                        <div className="space-y-3">
                            {/* MetaMask SDK Button (Mobile Priority) */}
                            {isMobile && (
                                <button
                                    onClick={onConnectMetaMaskSDK}
                                    disabled={isConnecting}
                                    className="w-full flex items-center gap-4 p-4 bg-[#f6851b]/10 hover:bg-[#f6851b]/20 border border-[#f6851b]/30 rounded-xl transition-all disabled:opacity-50"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-[#f6851b] flex items-center justify-center">
                                        <span className="text-xl">🦊</span>
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="font-bold text-white">MetaMask</p>
                                        <p className="text-xs text-white/50">Open in MetaMask app</p>
                                    </div>
                                    {isConnecting ? (
                                        <Loader2 className="w-5 h-5 text-[#f6851b] animate-spin" />
                                    ) : (
                                        <Smartphone className="w-5 h-5 text-[#f6851b]" />
                                    )}
                                </button>
                            )}

                            {/* Detected Wallets */}
                            {wallets.map((wallet) => (
                                <button
                                    key={wallet.uuid}
                                    onClick={() => onSelectWallet(wallet)}
                                    disabled={isConnecting}
                                    className="w-full flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all disabled:opacity-50"
                                >
                                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/10 flex items-center justify-center">
                                        {wallet.icon ? (
                                            <img
                                                src={wallet.icon}
                                                alt={wallet.name}
                                                className="w-8 h-8"
                                            />
                                        ) : (
                                            <span className="text-xl">💎</span>
                                        )}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="font-bold text-white">{wallet.name}</p>
                                        <p className="text-xs text-white/50">Browser extension</p>
                                    </div>
                                    {isConnecting && (
                                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                                    )}
                                </button>
                            ))}

                            {/* Reown / WalletConnect Button */}
                            <button
                                onClick={() => {
                                    open();
                                    onClose();
                                }}
                                disabled={isConnecting}
                                className="w-full flex items-center gap-4 p-4 bg-[#3B99FC]/10 hover:bg-[#3B99FC]/20 border border-[#3B99FC]/30 rounded-xl transition-all disabled:opacity-50"
                            >
                                <div className="w-10 h-10 rounded-xl bg-[#3B99FC] flex items-center justify-center">
                                    <span className="text-xl">📡</span>
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-bold text-white">WalletConnect</p>
                                    <p className="text-xs text-white/50">Reown / Other Wallets</p>
                                </div>
                            </button>

                            {/* Mobile: No wallets but show MetaMask SDK (only if SDK not already shown above logic) */}
                            {wallets.length === 0 && isMobile && !isConnecting && (
                                <p className="text-center text-white/40 text-sm py-2">
                                    Or use WalletConnect above
                                </p>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
