"use client";

import { useSettings } from "@/lib/settings-context";
import { Zap, ZapOff } from "lucide-react";
import { motion } from "framer-motion";

export default function SettingsToggle() {
    const { reduceMotion, toggleReduceMotion } = useSettings();

    return (
        <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors group"
            onClick={toggleReduceMotion}
            title={reduceMotion ? "Enable Motion" : "Reduce Motion"}
        >
            {reduceMotion ? (
                <ZapOff className="w-5 h-5 text-gray-400 group-hover:text-white" />
            ) : (
                <Zap className="w-5 h-5 text-neon-cyan" />
            )}
        </motion.button>
    );
}
