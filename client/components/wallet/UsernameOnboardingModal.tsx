"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, CheckCircle, AlertCircle, Sparkles } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import NeonButton from "@/components/ui/NeonButton";

interface UsernameOnboardingModalProps {
    isOpen: boolean;
    onClose: () => void; // Should probably not allow closing without picking? Or maybe allow back?
    onSubmit: (username: string) => Promise<boolean>; // Returns true if success
    suggestedUsername?: string;
    walletAddress?: string;
}

export default function UsernameOnboardingModal({ isOpen, onClose, onSubmit, suggestedUsername, walletAddress }: UsernameOnboardingModalProps) {
    const [username, setUsername] = useState(suggestedUsername || "");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const success = await onSubmit(username);
            if (!success) {
                // onSubmit should handle setting specific error if needed, but if it returns false, we assume generic or "Taken"
                // Assuming the parent component handles the API call and throws/sets error, 
                // but here we expect boolean. 
                // Let's rely on parent to pass error text? 
                // Actually, cleaner if onSubmit is async and throws if failed.
            } else {
                // Success! Modal will likely be closed by parent or unmounted
            }
        } catch (err: any) {
            setError(err.message || "Failed to claim username");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/80 backdrop-blur-md"
                />

                {/* Modal Content */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="relative w-full max-w-md"
                >
                    <GlassCard className="p-8 text-center border-neon-cyan/30 shadow-[0_0_50px_rgba(0,240,255,0.1)]">

                        {/* Identify Icon */}
                        <div className="w-20 h-20 mx-auto mb-6 relative">
                            <div className="absolute inset-0 bg-neon-cyan/20 rounded-full animate-pulse" />
                            <div className="relative w-full h-full bg-black/40 rounded-full border border-neon-cyan/50 flex items-center justify-center text-neon-cyan">
                                <Sparkles size={32} />
                            </div>
                        </div>

                        <h2 className="text-2xl font-heading font-bold text-white mb-2">
                            Claim Your Identity
                        </h2>
                        <p className="text-white/60 mb-8 text-sm leading-relaxed">
                            The username you wanted is taken. <br />
                            Choose a unique alias to stand out in the leaderboard.
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="text-left relative">
                                <label className="text-xs font-bold text-neon-cyan uppercase tracking-wider mb-2 block">
                                    Username
                                </label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 h-4 w-4" />
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => {
                                            setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '')); // Simple alphanumeric filter
                                            setError(null);
                                        }}
                                        placeholder="Enter username..."
                                        maxLength={20}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-4 text-white text-lg font-mono placeholder:text-white/20 focus:outline-none focus:border-neon-cyan/50 transition-all"
                                        autoFocus
                                    />
                                </div>
                                {error && (
                                    <motion.p
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-neon-coral text-xs mt-2 flex items-center gap-1"
                                    >
                                        <AlertCircle size={12} /> {error}
                                    </motion.p>
                                )}
                            </div>

                            <NeonButton
                                variant="cyan"
                                type="submit"
                                disabled={!username || loading}
                                className="w-full py-4 text-lg font-bold"
                            >
                                {loading ? "Checking..." : "Claim Identity"}
                            </NeonButton>
                        </form>

                        <div className="mt-6 text-xs text-white/20">
                            Wallet: {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Connecting...'}
                        </div>
                    </GlassCard>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
