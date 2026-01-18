import { X, Check, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

interface DepositSuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    amount: string;
    symbol: string;
    txHash?: string;
}

export function DepositSuccessModal({ isOpen, onClose, amount, symbol, txHash }: DepositSuccessModalProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setVisible(true);
        } else {
            setTimeout(() => setVisible(false), 300);
        }
    }, [isOpen]);

    if (!visible) return null;

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className={`relative bg-[#0A0A0C] border border-success/30 rounded-2xl p-6 w-full max-w-md shadow-[0_0_50px_rgba(0,255,148,0.1)] transform transition-transform duration-300 ${isOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-4"}`}>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                {/* Success Icon */}
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center ring-1 ring-success/50 shadow-[0_0_20px_rgba(0,255,148,0.2)]">
                        <Check size={32} className="text-success" />
                    </div>
                </div>

                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-white mb-2">Deposit Successful!</h2>
                    <p className="text-white/60 text-sm">Your funds have been securely deposited.</p>
                </div>

                {/* Details Grid */}
                <div className="space-y-4 mb-8">
                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                        <span className="text-white/40 text-sm">Amount Added</span>
                        <span className="font-bold font-mono text-success text-lg">
                            +{amount} {symbol}
                        </span>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                        <span className="text-white/40 text-sm">Status</span>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                            <span className="text-white font-mono text-sm">Confirmed</span>
                        </div>
                    </div>
                </div>

                {/* Transaction Hash */}
                {txHash && (
                    <div className="text-center mb-6">
                        <a
                            href={`https://testnet.bscscan.com/tx/${txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-xs text-white/30 hover:text-white transition-colors"
                        >
                            View on BSCScan <ExternalLink size={10} />
                        </a>
                    </div>
                )}

                {/* Action Button */}
                <button
                    onClick={onClose}
                    className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
                >
                    Done
                </button>
            </div>
        </div>
    );
}
