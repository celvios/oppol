import { X, AlertTriangle, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import NeonButton from "@/components/ui/NeonButton";
import Link from "next/link";

interface InsufficientBalanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    needed: string;
    balance: string;
}

export function InsufficientBalanceModal({ isOpen, onClose, needed, balance }: InsufficientBalanceModalProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setVisible(true);
        } else {
            const timer = setTimeout(() => setVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!visible && !isOpen) return null;

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className={`relative bg-[#0A0A0C] border border-orange-500/30 rounded-2xl p-6 w-full max-w-sm shadow-[0_0_50px_rgba(255,140,0,0.15)] transform transition-transform duration-300 ${isOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-4"}`}>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                {/* Warning Icon */}
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center ring-1 ring-orange-500/50 shadow-[0_0_30px_rgba(255,140,0,0.2)]">
                        <AlertTriangle size={32} className="text-orange-500" />
                    </div>
                </div>

                <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-white mb-2">Insufficient Balance</h2>
                    <p className="text-white/60 text-sm leading-relaxed">
                        You don't have enough USCUSD to place this trade.
                    </p>
                </div>

                {/* Balance Details */}
                <div className="bg-white/5 rounded-xl p-4 mb-6 space-y-3 border border-white/5">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-white/40">Required</span>
                        <span className="font-mono text-white">${parseFloat(needed).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-white/40">Available</span>
                        <span className="font-mono text-orange-400">${parseFloat(balance).toFixed(2)}</span>
                    </div>
                    <div className="h-px bg-white/10 my-2" />
                    <div className="flex justify-between items-center text-sm font-medium">
                        <span className="text-white/60">Missing</span>
                        <span className="font-mono text-orange-500">
                            ${(parseFloat(needed) - parseFloat(balance)).toFixed(2)}
                        </span>
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                    <Link href="/deposit" className="block w-full">
                        <NeonButton variant="orange" className="w-full py-3 flex items-center justify-center gap-2">
                            DEPOSIT FUNDS <ArrowRight size={14} />
                        </NeonButton>
                    </Link>

                    <button
                        onClick={onClose}
                        className="w-full py-3 text-sm text-white/40 hover:text-white transition-colors"
                    >
                        Maybe later
                    </button>
                </div>
            </div>
        </div>
    );
}
