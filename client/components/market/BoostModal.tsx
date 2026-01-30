"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check, Loader2, Rocket, Zap, Flame, Crown } from "lucide-react";
import { motion } from "framer-motion";
import { BOOST_TIERS, BoostService } from "@/lib/boost-service";
import NeonButton from "@/components/ui/NeonButton";

interface BoostModalProps {
    marketId: number | string;
    onClose: () => void;
}

export function BoostModal({ marketId, onClose }: BoostModalProps) {
    const [selectedTier, setSelectedTier] = useState(BOOST_TIERS[1]); // Default to Standard
    const [txHash, setTxHash] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
    const [message, setMessage] = useState("");
    const [copied, setCopied] = useState(false);

    const adminWallet = BoostService.getAdminWallet();

    const copyWallet = () => {
        navigator.clipboard.writeText(adminWallet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleVerify = async () => {
        if (!txHash || txHash.length < 10) {
            setMessage("Please enter a valid Transaction Hash");
            setStatus("error");
            return;
        }

        setIsVerifying(true);
        setStatus("idle");
        setMessage("");

        try {
            const res = await BoostService.verifyBoost(marketId, txHash, selectedTier.id);
            if (res.success) {
                setStatus("success");
                setMessage("Market Boosted Successfully! 🚀");
                setTimeout(() => {
                    window.location.reload(); // Refresh to show boost
                }, 2000);
            } else {
                setStatus("error");
                setMessage(res.message || "Verification failed");
            }
        } catch (e) {
            setStatus("error");
            setMessage("Network error");
        } finally {
            setIsVerifying(false);
        }
    };

    const getTierIcon = (id: number) => {
        switch (id) {
            case 1: return <Zap className="w-8 h-8 text-blue-400 fill-blue-400/20" />; // Flash
            case 2: return <Flame className="w-8 h-8 text-purple-400 fill-purple-400/20" />; // Standard
            case 3: return <Crown className="w-8 h-8 text-yellow-400 fill-yellow-400/20" />; // Whale
            default: return <Rocket className="w-8 h-8" />;
        }
    };

    // Use Portal to breakout of stacking contexts (z-index fixes for iOS/Mobile)
    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-10"
            >
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-purple-900/20 to-blue-900/20">
                    <div className="flex items-center gap-2">
                        <Rocket className="w-5 h-5 text-neon-cyan" />
                        <h2 className="text-xl font-heading font-bold text-white">Boost Market</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5 text-white/50" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Tier Selection */}
                    <div className="grid grid-cols-3 gap-3">
                        {BOOST_TIERS.map((tier) => (
                            <button
                                key={tier.id}
                                onClick={() => setSelectedTier(tier)}
                                className={`relative p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${selectedTier.id === tier.id
                                    ? "bg-white/10 border-neon-cyan text-white shadow-[0_0_15px_rgba(0,255,255,0.2)]"
                                    : "bg-white/5 border-white/5 text-white/60 hover:bg-white/10"
                                    }`}
                            >
                                <span className="text-2xl pt-2 pb-1">{getTierIcon(tier.id)}</span>
                                <div className="text-center">
                                    <div className="font-bold text-sm tracking-tight">{tier.name}</div>
                                    <div className="text-xs opacity-70">{tier.hours < 24 ? `${tier.hours}h` : `${tier.hours / 24} Days`}</div>
                                </div>
                                <div className={`px-2 py-0.5 rounded text-xs font-bold bg-white text-black mt-1`}>
                                    ${tier.price}
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Payment Instructions */}
                    <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-3">
                        <div className="text-sm text-text-secondary text-center">
                            Send <span className="text-white font-bold">${selectedTier.price} USDT</span> to this address:
                        </div>

                        <div
                            onClick={copyWallet}
                            className="flex items-center justify-between bg-black/50 p-3 rounded-lg border border-white/10 cursor-pointer hover:border-white/20 group"
                        >
                            <span className="font-mono text-xs md:text-sm text-neon-cyan truncate mr-2">
                                {adminWallet}
                            </span>
                            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-white/50 group-hover:text-white" />}
                        </div>
                    </div>

                    {/* Verification Input */}
                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest text-text-secondary font-bold">Transaction Hash</label>
                        <input
                            type="text"
                            placeholder="Paste TX Hash (0x123...)"
                            value={txHash}
                            onChange={(e) => setTxHash(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white font-mono text-sm focus:border-neon-cyan outline-none transition-colors"
                        />
                    </div>

                    {/* Status Message */}
                    {status === "error" && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
                            {message}
                        </div>
                    )}
                    {status === "success" && (
                        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm text-center font-bold animate-pulse">
                            {message}
                        </div>
                    )}

                    <NeonButton
                        variant="cyan"
                        onClick={handleVerify}
                        disabled={isVerifying || status === "success"}
                        className="w-full py-4 text-lg"
                    >
                        {isVerifying ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" /> Verifying...
                            </div>
                        ) : (
                            "Verify Payment 🚀"
                        )}
                    </NeonButton>
                </div>
            </motion.div>
        </div>,
        document.body
    );
}
