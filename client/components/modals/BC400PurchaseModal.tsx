import { X, ExternalLink, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BC400PurchaseModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function BC400PurchaseModal({ isOpen, onClose }: BC400PurchaseModalProps) {
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

                    <div className="relative z-10 text-center">
                        <div className="w-16 h-16 rounded-full bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center mx-auto mb-5">
                            <ShieldAlert className="w-8 h-8 text-neon-purple" />
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2">Access Restricted</h3>

                        <p className="text-white/60 text-sm leading-relaxed mb-6">
                            You don’t have a <span className="text-neon-cyan font-bold">BC400 NFT</span> on this address to create a Poll/Market. Make sure there is a BC400 NFT in your wallet.
                        </p>

                        <a
                            href={`https://pancakeswap.finance/swap?outputCurrency=${process.env.NEXT_PUBLIC_BC400_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000'}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-2 bg-[#1FC7D4] hover:bg-[#1FC7D4]/90 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(31,199,212,0.3)] mb-3"
                        >
                            <img src="https://pancakeswap.finance/logo.png" alt="PancakeSwap" className="w-5 h-5" onError={(e) => e.currentTarget.style.display = 'none'} />
                            Buy on PancakeSwap <ExternalLink size={16} />
                        </a>

                        <button
                            onClick={onClose}
                            className="w-full py-3 text-sm text-white/40 hover:text-white transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
