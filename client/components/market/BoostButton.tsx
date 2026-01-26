"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BoostModal } from "./BoostModal";

interface BoostButtonProps {
    marketId: number | string;
    isBoosted?: boolean;
}

export default function BoostButton({ marketId, isBoosted }: BoostButtonProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (isBoosted) {
        return (
            <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 text-xs font-bold font-mono animate-pulse">
                <Zap className="w-3 h-3 fill-yellow-400" />
                BOOSTED
            </div>
        );
    }

    return (
        <>
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-neon-cyan/50 text-xs font-medium text-white/70 hover:text-white transition-all group"
            >
                <Zap className="w-3.5 h-3.5 group-hover:text-neon-cyan transition-colors" />
                Boost
            </motion.button>

            <AnimatePresence>
                {isOpen && <BoostModal marketId={marketId} onClose={() => setIsOpen(false)} />}
            </AnimatePresence>
        </>
    );
}
