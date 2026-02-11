"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, Mail } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import NeonButton from "@/components/ui/NeonButton";
import { useAppKit } from "@reown/appkit/react";
import { signIn } from "next-auth/react";

interface LoginSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function LoginSelectionModal({ isOpen, onClose }: LoginSelectionModalProps) {
    const { open } = useAppKit();

    const handleWalletLogin = async () => {
        onClose();
        await open();
    };

    const handleGoogleLogin = async () => {
        // onClose(); // Optional: close before or after? usually redirects immediately.
        await signIn('google');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-void/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed z-[101] w-full max-w-md pointer-events-none flex items-center justify-center inset-0"
                    >
                        <GlassCard className="pointer-events-auto w-full max-w-sm p-6 relative border-neon-cyan/20 shadow-[0_0_50px_rgba(0,224,255,0.1)]">
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>

                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold font-heading mb-2">Welcome to OPoll</h2>
                                <p className="text-sm text-text-secondary">Choose how you want to connect</p>
                            </div>

                            <div className="space-y-4">
                                {/* Wallet Option */}
                                <button
                                    onClick={handleWalletLogin}
                                    className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-neon-cyan/50 hover:shadow-[0_0_15px_rgba(0,224,255,0.2)] transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Wallet className="w-5 h-5 text-primary" />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-bold text-white">Connect Wallet</div>
                                            <div className="text-xs text-white/50">MetaMask, Trust, WalletConnect</div>
                                        </div>
                                    </div>
                                    <div className="w-2 h-2 rounded-full bg-primary/50 group-hover:bg-primary transition-colors" />
                                </button>

                                {/* Divider */}
                                <div className="relative py-2">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-white/10" />
                                    </div>
                                    <div className="relative flex justify-center text-xs">
                                        <span className="bg-[#05050A] px-2 text-white/30 uppercase tracking-widest">or</span>
                                    </div>
                                </div>

                                {/* Google Option */}
                                <button
                                    onClick={handleGoogleLogin}
                                    className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/30 transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <img src="https://authjs.dev/img/providers/google.svg" alt="Google" className="w-5 h-5" />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-bold text-white">Continue with Google</div>
                                            <div className="text-xs text-white/50">Secure Social Login</div>
                                        </div>
                                    </div>
                                </button>
                            </div>

                            <div className="mt-8 text-center">
                                <p className="text-[10px] text-white/20">
                                    By connecting, you agree to our Terms of Service & Privacy Policy
                                </p>
                            </div>
                        </GlassCard>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
