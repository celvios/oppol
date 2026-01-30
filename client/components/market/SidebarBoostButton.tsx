"use client";

import { useState } from "react";
import { Zap, X, Link as LinkIcon, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BoostModal } from "./BoostModal";
import NeonButton from "@/components/ui/NeonButton";

interface SidebarBoostButtonProps {
    className?: string;
    compact?: boolean;
}

export default function SidebarBoostButton({ className = "", compact = false }: SidebarBoostButtonProps) {
    const [isInputOpen, setIsInputOpen] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const [error, setError] = useState("");
    const [targetMarketId, setTargetMarketId] = useState<string | null>(null);

    const handleOpenInput = () => {
        setIsInputOpen(true);
        setInputValue("");
        setError("");
    };

    const handleVisualize = () => {
        setError("");
        const input = inputValue.trim();

        if (!input) {
            setError("Please enter a link or ID");
            return;
        }

        let marketId = null;

        // 1. Direct Number
        if (/^\d+$/.test(input)) {
            marketId = input;
        }
        // 2. URL Parameter (?marketId=123)
        else if (input.includes("marketId=")) {
            const match = input.match(/[?&]marketId=(\d+)/);
            if (match) marketId = match[1];
        }
        // 3. General Link - Try to find the last number in URL
        else {
            // Fallback: try to find any sequence of digits at the end or in path
            const match = input.match(/\/(\d+)\/?$/) || input.match(/(\d+)/);
            // Caution: simple regex, strictly looking for digits
            if (match) marketId = match[1];
        }

        if (marketId) {
            setTargetMarketId(marketId);
            setIsInputOpen(false); // Close input, open BoostModal
        } else {
            setError("Could not extract Market ID from link");
        }
    };

    return (
        <>
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleOpenInput}
                className={`flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-white/10 hover:border-neon-cyan/50 hover:from-purple-900/60 hover:to-blue-900/60 transition-all font-bold text-white group ${compact ? 'p-2 aspect-square' : 'w-full p-3 text-xs'} ${className}`}
            >
                <Zap className={`${compact ? 'w-5 h-5' : 'w-4 h-4'} text-neon-cyan group-hover:text-white transition-colors fill-neon-cyan/20`} />
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
