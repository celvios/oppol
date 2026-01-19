"use client";

import React from "react";
import { motion } from "framer-motion";

interface LogoBrandProps {
    className?: string;
}

export default function LogoBrand({ className = "" }: LogoBrandProps) {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className="relative w-10 h-10 flex items-center justify-center">
                <img
                    src="/brand-logo.png"
                    alt="O"
                    className="w-full h-full object-contain"
                />
            </div>

            <div className="flex flex-col">
                <span className="font-heading font-bold text-lg leading-none tracking-wider text-white mt-1">
                    POLL
                </span>
                <span className="font-mono text-[9px] text-neon-cyan tracking-[0.2em] leading-none">
                    PREDICTION MARKET
                </span>
            </div>
        </div>
    );
}
