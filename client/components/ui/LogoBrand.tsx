"use client";

import React from "react";
import { motion } from "framer-motion";

interface LogoBrandProps {
    className?: string;
}

export default function LogoBrand({ className = "" }: LogoBrandProps) {
    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <div className="relative w-8 h-8 flex items-center justify-center">
                {/* Outer Ring */}
                <motion.div
                    className="absolute inset-0 border-2 border-neon-cyan/50 rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                />

                {/* Inner Ring */}
                <motion.div
                    className="absolute inset-1 border-2 border-neon-green/50 rounded-full"
                    animate={{ rotate: -360 }}
                    transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
                />

                {/* Core */}
                <div className="w-2 h-2 bg-white rounded-full shadow-[0_0_10px_white]" />
            </div>

            <div className="flex flex-col">
                <span className="font-heading font-bold text-lg leading-none tracking-wider text-white">
                    OPOLL
                </span>
                <span className="font-mono text-[9px] text-neon-cyan tracking-[0.2em] leading-none">
                    PREDICTION MARKET
                </span>
            </div>
        </div>
    );
}
