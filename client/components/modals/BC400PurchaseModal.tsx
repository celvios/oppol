import { useState, useEffect } from "react";
import { X, ExternalLink, ShieldAlert, ArrowDown, Wallet, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePancakeSwap } from "@/lib/use-pancake-swap";

interface BC400PurchaseModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function BC400PurchaseModal({ isOpen, onClose }: BC400PurchaseModalProps) {
    const { getEstimatedOutput, swap, isLoading, error: swapError, estimateError } = usePancakeSwap();
    const [amountIn, setAmountIn] = useState('');
    const [estimatedOut, setEstimatedOut] = useState('0');
    const [isSwapping, setIsSwapping] = useState(false);

    // Default to BNB for simplicity
    const TOKEN_IN = 'BNB';
    const TOKEN_OUT = process.env.NEXT_PUBLIC_BC400_CONTRACT_ADDRESS || '0xB929177331De755d7aCc5665267a247e458bCdeC';

    useEffect(() => {
        const fetchEstimate = async () => {
            if (!amountIn || parseFloat(amountIn) === 0) {
                setEstimatedOut('0');
                return;
            }
            // Debounce could be added here
            const out = await getEstimatedOutput(amountIn, TOKEN_IN, TOKEN_OUT);
            setEstimatedOut(Number(out).toFixed(2));
        };
        fetchEstimate();
    }, [amountIn, getEstimatedOutput, TOKEN_OUT]);

    const handleSwap = async () => {
        if (!amountIn) return;
        setIsSwapping(true);
        const success = await swap(amountIn, TOKEN_IN, TOKEN_OUT);
        setIsSwapping(false);
        if (success) {
            onClose();
            // Optional: Trigger a refresh of the balance check here
            window.location.reload();
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                />

                {/* Modal */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden"
                >
                    {/* Background Glow */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-neon-purple/20 blur-[60px]" />

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="relative z-10">
                        <div className="text-center mb-6">
                            <div className="w-12 h-12 rounded-full bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center mx-auto mb-3">
                                <ShieldAlert className="w-6 h-6 text-neon-purple" />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-1">Access Restricted</h3>
                            <p className="text-white/50 text-xs px-4">
                                Must hold <span className="text-neon-cyan">1 BC400 NFT</span> OR <span className="text-neon-purple">10M+ BC400 Tokens</span> to create polls.
                            </p>
                        </div>

                        {/* Swap Input */}
                        <div className="space-y-4">
                            {/* You Pay */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                <label className="text-xs text-white/40 mb-1 block">You Pay</label>
                                <div className="flex justify-between items-center">
                                    <input
                                        type="number"
                                        placeholder="0.0"
                                        value={amountIn}
                                        onChange={(e) => setAmountIn(e.target.value)}
                                        className="bg-transparent text-xl font-bold text-white outline-none w-full"
                                    />
                                    <div className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded-lg border border-white/10">
                                        <div className="w-5 h-5 rounded-full bg-[#F3BA2F]" />
                                        <span className="text-sm font-bold">BNB</span>
                                    </div>
                                </div>
                            </div>

                            {/* Arrow */}
                            <div className="flex justify-center -my-2 relative z-10">
                                <div className="bg-[#0a0a0a] border border-white/10 p-1.5 rounded-full">
                                    <ArrowDown size={14} className="text-white/60" />
                                </div>
                            </div>

                            {/* You Receive */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                <label className="text-xs text-white/40 mb-1 block">You Receive (Estimated)</label>
                                <div className="flex justify-between items-center">
                                    <span className="text-xl font-bold text-white">{estimatedOut}</span>
                                    <div className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded-lg border border-white/10">
                                        <div className="w-5 h-5 rounded-full bg-neon-purple" />
                                        <span className="text-sm font-bold">BC400</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Error Message */}
                        {(swapError || estimateError) && (
                            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-500 text-center">
                                {swapError || estimateError}
                            </div>
                        )}

                        {/* Action Button */}
                        <button
                            onClick={handleSwap}
                            disabled={!amountIn || isLoading || isSwapping}
                            className="w-full mt-6 flex items-center justify-center gap-2 bg-neon-purple hover:bg-neon-purple/90 disabled:bg-white/5 disabled:text-white/20 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(157,78,221,0.3)]"
                        >
                            {isLoading || isSwapping ? <Loader2 className="animate-spin w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                            {isLoading || isSwapping ? 'Processing...' : 'Swap BNB for BC400'}
                        </button>

                        <div className="mt-4 text-center">
                            <span className="text-[10px] text-white/30">Powered by PancakeSwap V2 Router</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
