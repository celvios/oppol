"use client";

import { X, Twitter, Send, Download, Copy, Check, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import NeonButton from "./NeonButton";

interface ShareChartModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageSrc: string | null;
    marketQuestion: string;
    marketId: number | string;
}

export function ShareChartModal({ isOpen, onClose, imageSrc, marketQuestion, marketId }: ShareChartModalProps) {
    const [copied, setCopied] = useState(false);

    // Reset copied state when modal opens/closes
    useEffect(() => {
        if (!isOpen) setCopied(false);
    }, [isOpen]);

    const handleCopy = async () => {
        if (!imageSrc) return;
        try {
            // Fetch the image blob
            const response = await fetch(imageSrc);
            const blob = await response.blob();
            // detailed writing to clipboard
            await navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob
                })
            ]);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy image:", err);
            // Fallback: Copy generic text/link
            navigator.clipboard.writeText(`Check out this market on OPoll: ${window.location.origin}/trade?marketId=${marketId}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleDownload = () => {
        if (!imageSrc) return;
        const link = document.createElement('a');
        link.download = `OPoll-Chart-${marketId}-${Date.now()}.png`;
        link.href = imageSrc;
        link.click();
    };

    const handleTwitter = () => {
        const text = `Check out the odds for: ${marketQuestion}`;
        const url = `${window.location.origin}/trade?marketId=${marketId}`;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    };

    const handleTelegram = () => {
        const text = `Check out the odds for: ${marketQuestion}`;
        const url = `${window.location.origin}/trade?marketId=${marketId}`;
        window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="relative w-full max-w-lg bg-[#0A0A0C] border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(39,232,167,0.1)] flex flex-col max-h-[90vh]"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <div className="flex items-center gap-2">
                                <Share2 className="w-5 h-5 text-neon-cyan" />
                                <h2 className="text-lg font-bold text-white">Share Chart</h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white/50 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Image Preview Container */}
                        <div className="p-6 flex-1 overflow-y-auto bg-[url('/grid-pattern.svg')] bg-repeat bg-opacity-5">
                            <div className="relative group rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-[#020408]">
                                {imageSrc ? (
                                    <img
                                        src={imageSrc}
                                        alt="Chart Preview"
                                        className="w-full h-auto object-contain block"
                                    />
                                ) : (
                                    <div className="h-64 flex items-center justify-center text-white/30 animate-pulse">
                                        Generating Preview...
                                    </div>
                                )}

                                {/* Hover Gradient */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                            </div>

                            <p className="mt-4 text-center text-xs text-white/40 font-mono">
                                Use the options below to share this snapshot
                            </p>
                        </div>

                        {/* Actions Footer */}
                        <div className="p-4 pb-24 md:pb-4 bg-white/5 border-t border-white/10">
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <button
                                    onClick={handleTwitter}
                                    className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#1DA1F2]/10 text-[#1DA1F2] border border-[#1DA1F2]/20 hover:bg-[#1DA1F2]/20 active:scale-[0.98] transition-all font-bold text-sm"
                                >
                                    <Twitter size={18} />
                                    Post to X
                                </button>
                                <button
                                    onClick={handleTelegram}
                                    className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#0088cc]/10 text-[#0088cc] border border-[#0088cc]/20 hover:bg-[#0088cc]/20 active:scale-[0.98] transition-all font-bold text-sm"
                                >
                                    <Send size={18} />
                                    Telegram
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={handleDownload}
                                    className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white/5 text-white border border-white/10 hover:bg-white/10 active:scale-[0.98] transition-all font-bold text-sm"
                                >
                                    <Download size={18} />
                                    Download
                                </button>
                                <button
                                    onClick={handleCopy}
                                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border active:scale-[0.98] transition-all font-bold text-sm ${copied
                                        ? "bg-neon-green/20 text-neon-green border-neon-green/30"
                                        : "bg-white/5 text-white border-white/10 hover:bg-white/10"
                                        }`}
                                >
                                    {copied ? <Check size={18} /> : <Copy size={18} />}
                                    {copied ? "Copied!" : "Copy Image"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
