"use client";

import { useState } from "react";
import { Zap, X, Link as LinkIcon, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BoostModal } from "./BoostModal";
import NeonButton from "@/components/ui/NeonButton";

interface SidebarBoostButtonProps {
    className?: string;
    compact?: boolean;
    variant?: 'default' | 'yellow';
}

export default function SidebarBoostButton({ className = "", compact = false, variant = 'default' }: SidebarBoostButtonProps) {
    const [isInputOpen, setIsInputOpen] = useState(false);
    // ... (state)

    // Style configuration
    const styles = {
        default: {
            container: "bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-white/10 hover:border-neon-cyan/50 hover:from-purple-900/60 hover:to-blue-900/60",
            icon: "text-neon-cyan fill-neon-cyan/20"
        },
        yellow: {
            container: "bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-amber-500/30 hover:border-amber-500/80 hover:from-amber-500/30 hover:to-yellow-500/30",
            icon: "text-amber-500 fill-amber-500/20"
        }
    };

    const currentStyle = styles[variant];

    return (
        <>
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleOpenInput}
                className={`flex items-center justify-center gap-2 rounded-xl border transition-all font-bold text-white group ${currentStyle.container} ${compact ? 'p-2 aspect-square' : 'w-full p-3 text-xs'} ${className}`}
            >
                <Zap className={`${compact ? 'w-5 h-5' : 'w-4 h-4'} ${currentStyle.icon} group-hover:text-white transition-colors`} />
                {!compact && <span>BOOST MARKET</span>}
            </motion.button>

            <AnimatePresence>
                {isInputOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsInputOpen(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />

                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl p-6 overflow-hidden"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-lg font-heading font-bold text-white flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-neon-cyan" />
                                    Boost Any Market
                                </h2>
                                <button onClick={() => setIsInputOpen(false)} className="text-white/50 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <p className="text-text-secondary text-sm">
                                    Paste a market link or ID to start a boost campaign.
                                </p>

                                <div className="space-y-2">
                                    <div className="relative">
                                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
                                        <input
                                            type="text"
                                            placeholder="Paste link here..."
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-neon-cyan transition-colors font-mono"
                                            autoFocus
                                        />
                                    </div>
                                    {error && (
                                        <div className="flex items-center gap-2 text-red-400 text-xs">
                                            <AlertCircle size={12} />
                                            {error}
                                        </div>
                                    )}
                                </div>

                                <div className="pt-2">
                                    <NeonButton
                                        variant="cyan"
                                        className="w-full"
                                        onClick={handleVisualize}
                                    >
                                        Continue
                                    </NeonButton>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {targetMarketId && (
                    <BoostModal
                        marketId={targetMarketId}
                        onClose={() => setTargetMarketId(null)}
                    />
                )}
            </AnimatePresence>
        </>
    );
}
