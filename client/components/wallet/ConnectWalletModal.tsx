"use client";

import { useEffect, useState } from "react";
import { Wallet, X, Loader2, Sparkles, Zap, ShieldCheck } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import NeonButton from "@/components/ui/NeonButton";
import { usePrivy } from "@privy-io/react-auth";
import UsernameOnboardingModal from "./UsernameOnboardingModal";
import { motion, AnimatePresence } from "framer-motion";

interface ConnectWalletModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConnect: () => Promise<void> | void;
    context: 'bet' | 'deposit' | 'withdraw' | 'portfolio' | 'general' | 'create';
    contextData?: {
        marketName?: string;
        amount?: string;
    };
}

export default function ConnectWalletModal({
    isOpen,
    onClose,
    onConnect,
    context,
    contextData
}: ConnectWalletModalProps) {
    const { login, ready, authenticated } = usePrivy();
    const [loading, setLoading] = useState(false);
    const [showIdentityModal, setShowIdentityModal] = useState(false);
    const [conflictDetails, setConflictDetails] = useState<{ suggested: string, wallet: string } | null>(null);

    useEffect(() => {
        if (authenticated && isOpen) {
            onClose();
        }
    }, [authenticated, isOpen, onClose]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    const handleConnect = async () => {
        try {
            setLoading(true);
            onClose();
            await login();
        } catch (error) {
            console.error('[ConnectWalletModal] Connection error:', error);
        } finally {
            setLoading(false);
        }
    };

    const getContextInfo = () => {
        switch (context) {
            case 'bet':
                return {
                    title: "Ready to Win?",
                    subtitle: `Place your prediction on ${contextData?.marketName || 'the future'}`,
                    icon: Zap
                };
            case 'deposit':
                return {
                    title: "Fuel Your Account",
                    subtitle: "Add funds to start trading instantly",
                    icon: Wallet
                };
            case 'create':
                return {
                    title: "Become the House",
                    subtitle: "Launch your own prediction market",
                    icon: Sparkles
                };
            default:
                return {
                    title: "Unlock the Future",
                    subtitle: "Connect to access decentralized prediction markets",
                    icon: Wallet
                };
        }
    };

    const content = getContextInfo();
    const Icon = content.icon;

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop with blur and pulse */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/90 backdrop-blur-md"
                    onClick={onClose}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 to-neon-purple/5 animate-pulse" />
                </motion.div>

                {/* Main Card */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative w-full max-w-md"
                >
                    {/* Glowing Border Effect */}
                    <div className="absolute -inset-[1px] bg-gradient-to-r from-neon-cyan via-purple-500 to-neon-cyan rounded-2xl opacity-75 blur-sm animate-gradient-xy" />

                    <GlassCard className="relative w-full overflow-hidden border-none shadow-[0_0_50px_-10px_rgba(0,224,255,0.3)]">
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all z-10 group"
                        >
                            <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                        </button>

                        <div className="p-8 text-center relative z-10">
                            {/* Animated Icon Container */}
                            <motion.div
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                                className="w-24 h-24 mx-auto mb-6 relative group"
                            >
                                <div className="absolute inset-0 bg-neon-cyan/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-500" />
                                <div className="relative w-full h-full bg-gradient-to-br from-gray-900 to-black rounded-full border border-neon-cyan/50 flex items-center justify-center shadow-[0_0_15px_rgba(0,224,255,0.3)] group-hover:scale-105 transition-transform duration-300">
                                    <Icon className="w-10 h-10 text-neon-cyan drop-shadow-[0_0_10px_rgba(0,224,255,0.8)]" />
                                </div>
                                <div className="absolute -bottom-2 right-0 bg-black border border-neon-cyan/30 rounded-full p-1.5 shadow-lg">
                                    <ShieldCheck className="w-4 h-4 text-neon-green" />
                                </div>
                            </motion.div>

                            {/* Text Content */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                            >
                                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
                                    {content.title}
                                </h2>
                                <p className="text-white/60 text-sm mb-8 leading-relaxed max-w-[80%] mx-auto">
                                    {content.subtitle}
                                </p>
                            </motion.div>

                            {/* Action Button */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <NeonButton
                                    variant="cyan"
                                    onClick={handleConnect}
                                    disabled={loading || !ready}
                                    className="w-full py-5 text-lg font-bold shadow-[0_0_30px_rgba(0,224,255,0.3)] hover:shadow-[0_0_50px_rgba(0,224,255,0.5)] group relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                                    {loading ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span>Initiating...</span>
                                        </div>
                                    ) : (
                                        <span className="flex items-center justify-center gap-2">
                                            <Zap className="w-5 h-5 fill-current" />
                                            Start Playing
                                        </span>
                                    )}
                                </NeonButton>
                            </motion.div>

                            {/* Footer */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="mt-6 flex flex-col gap-2"
                            >
                                <p className="text-[10px] text-white/30 uppercase tracking-widest font-mono">
                                    Protected by Privy Secure Enclave
                                </p>
                                <div className="flex justify-center gap-3 opacity-30 grayscale hover:grayscale-0 transition-all duration-500">
                                    {/* Small icons for supported wallets as visual proof */}
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" className="w-4 h-4" alt="MetaMask" />
                                    <img src="https://raw.githubusercontent.com/WalletConnect/walletconnect-assets/master/Logo/Blue%20(Default)/Logo.svg" className="w-4 h-4" alt="WalletConnect" />
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" className="w-4 h-4" alt="Google" />
                                </div>
                            </motion.div>
                        </div>
                    </GlassCard>
                </motion.div>

                {/* Identity Modal (if needed) */}
                {showIdentityModal && conflictDetails && (
                    <UsernameOnboardingModal
                        isOpen={showIdentityModal}
                        onClose={() => setShowIdentityModal(false)}
                        suggestedUsername={conflictDetails.suggested}
                        onSubmit={(username) => {
                            // Logic for identity submit
                            console.log(username);
                        }}
                    />
                )}
            </div>
        </AnimatePresence>
    );
}
