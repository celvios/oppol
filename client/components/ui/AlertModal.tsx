import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, X, Check } from "lucide-react";

interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: "error" | "warning" | "info" | "success";
}

export function AlertModal({ isOpen, onClose, title, message, type = "error" }: AlertModalProps) {
    if (!isOpen) return null;

    const colors = {
        error: "text-danger border-danger/50 bg-danger/10",
        warning: "text-amber-500 border-amber-500/50 bg-amber-500/10",
        info: "text-primary border-primary/50 bg-primary/10",
        success: "text-neon-green border-neon-green/50 bg-neon-green/10",
    };

    const iconColors = {
        error: "text-danger",
        warning: "text-amber-500",
        info: "text-primary",
        success: "text-neon-green",
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-surface border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
                >
                    <div className="p-6 text-center relative">
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center border ${colors[type].replace("text-", "border-")}`}>
                            {type === 'success' ? (
                                <Check size={32} className={iconColors[type]} />
                            ) : (
                                <AlertCircle size={32} className={iconColors[type]} />
                            )}
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
                        <p className="text-white/60 mb-8">{message}</p>

                        <button
                            onClick={onClose}
                            className={`w-full py-3 rounded-xl font-bold text-black transition-transform active:scale-95 ${type === 'error' ? 'bg-danger hover:bg-danger/90' : 'bg-primary hover:bg-primary/90'}`}
                        >
                            Close
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
