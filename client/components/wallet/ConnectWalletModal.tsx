"use client";

import { useEffect, useState } from "react";
import { Wallet, X, Loader2, Sparkles, Zap, ShieldCheck, Mail, Globe } from "lucide-react";
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
    const [loadingMethod, setLoadingMethod] = useState<string | null>(null);
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

    const handleLogin = async (method: 'wallet' | 'email' | 'google') => {
        try {
            setLoadingMethod(method);
            // We do NOT close the modal immediately here, 
            // because for some methods (like wallet) we might want to keep our UI visible 
            // until the external provider takes over. 
            // However, Privy's modal or popup will appear on top.
            onClose();

            await login({ loginMethods: [method] });
        } catch (error) {
            console.error('[ConnectWalletModal] Connection error:', error);
        } finally {
            setLoadingMethod(null);
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
                                className="w-20 h-20 mx-auto mb-6 relative group"
                            >
                                <div className="absolute inset-0 bg-neon-cyan/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-500" />
                                <div className="relative w-full h-full bg-gradient-to-br from-gray-900 to-black rounded-full border border-neon-cyan/50 flex items-center justify-center shadow-[0_0_15px_rgba(0,224,255,0.3)] group-hover:scale-105 transition-transform duration-300">
                                    <Icon className="w-8 h-8 text-neon-cyan drop-shadow-[0_0_10px_rgba(0,224,255,0.8)]" />
                                </div>
                            </motion.div>

                            {/* Text Content */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                            >
                                <h2 className="text-3xl font-bold mb-2 tracking-tight bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                                    {content.title}
                                </h2>
                                <p className="text-white/60 text-sm mb-8 leading-relaxed max-w-[80%] mx-auto font-medium">
                                    {content.subtitle}
                                </p>
                            </motion.div>

                            {/* Action Buttons Stack */}
                            <div className="space-y-3">
                                {/* Email Button */}
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.15 }}
                                >
                                    <NeonButton
                                        variant="glass"
                                        onClick={() => handleLogin('email')}
                                        disabled={!!loadingMethod || !ready}
                                        className="w-full py-4 flex items-center justify-start gap-4 px-6 hover:bg-white/5 border border-white/10 hover:border-neon-cyan/50 transition-all group"
                                    >
                                        <div className="p-2 bg-white/5 rounded-full group-hover:bg-neon-cyan/20 transition-colors">
                                            <Mail className="w-5 h-5 text-white group-hover:text-neon-cyan" />
                                        </div>
                                        <span className="font-medium">Continue with Email</span>
                                        {loadingMethod === 'email' && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
                                    </NeonButton>
                                </motion.div>

                                {/* Google Button */}
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    <NeonButton
                                        variant="glass"
                                        onClick={() => handleLogin('google')}
                                        disabled={!!loadingMethod || !ready}
                                        className="w-full py-4 flex items-center justify-start gap-4 px-6 hover:bg-white/5 border border-white/10 hover:border-neon-cyan/50 transition-all group"
                                    >
                                        <div className="p-2 bg-white/5 rounded-full group-hover:bg-neon-cyan/20 transition-colors">
                                            <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" className="w-5 h-5" alt="Google" />
                                        </div>
                                        <span className="font-medium">Continue with Google</span>
                                        {loadingMethod === 'google' && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
                                    </NeonButton>
                                </motion.div>

                                {/* Wallet Button - Primary Emphasis */}
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.25 }}
                                >
                                    <NeonButton
                                        variant="cyan"
                                        onClick={() => handleLogin('wallet')}
                                        disabled={!!loadingMethod || !ready}
                                        className="w-full py-4 flex items-center justify-start gap-4 px-6 shadow-[0_0_20px_rgba(0,224,255,0.2)] hover:shadow-[0_0_30px_rgba(0,224,255,0.4)] group"
                                    >
                                        <div className="p-2 bg-black/20 rounded-full">
                                            <Wallet className="w-5 h-5 text-black" />
                                        </div>
                                        <span className="font-bold text-black">Connect Wallet</span>
                                        {loadingMethod === 'wallet' ? (
                                            <Loader2 className="w-4 h-4 animate-spin ml-auto text-black" />
                                        ) : (
                                            <div className="ml-auto flex -space-x-2">
                                                <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" className="w-6 h-6 rounded-full bg-white p-0.5 border border-black/10" alt="MetaMask" />
                                                <img src="https://raw.githubusercontent.com/WalletConnect/walletconnect-assets/master/Logo/Blue%20(Default)/Logo.svg" className="w-6 h-6 rounded-full bg-white p-0.5 border border-black/10" alt="WC" />
                                            </div>
                                        )}
                                    </NeonButton>
                                </motion.div>
                            </div>

                            {/* Footer */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.35 }}
                                className="mt-8 flex flex-col gap-2"
                            >
                                <p className="text-[10px] text-white/30 uppercase tracking-widest font-mono flex items-center justify-center gap-2">
                                    <span>Powered by</span>
                                    <span className="text-neon-cyan font-bold glow-sm">OPoll</span>
                                </p>
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
                            console.log(username); // Implement actual logic
                        }}
                    />
                )}
            </div>
        </AnimatePresence>
    );
}
