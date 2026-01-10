"use client";

import Link from "next/link";
import { Terminal } from "lucide-react";
import NeonButton from "@/components/ui/NeonButton";
import ScrambleText from "@/components/ui/ScrambleText";
import { motion } from "framer-motion";

export default function MobileHero() {
    return (
        <section className="relative min-h-[90vh] flex flex-col items-center justify-center p-6 text-center overflow-hidden md:hidden">
            {/* Background Decor */}
            <div className="absolute top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-neon-cyan/5 rounded-full blur-[80px] -z-10" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="flex flex-col items-center gap-6 z-10"
            >
                {/* Status Pill */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
                    <span className="text-[10px] font-mono font-bold tracking-widest text-neon-green">LIVE</span>
                </div>

                {/* Typography */}
                <h1 className="font-heading font-bold leading-tight">
                    <span className="text-6xl block text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 mb-2">
                        <ScrambleText text="OPOLL" />
                    </span>
                    <span className="text-2xl tracking-[0.3em] block text-neon-cyan/80">
                        PROTOCOL
                    </span>
                </h1>

                <p className="text-text-secondary text-sm leading-relaxed max-w-xs">
                    The world's first <span className="text-white">WhatsApp-Native</span> Prediction Market.
                    Liquidity like water.
                </p>

                {/* Actions */}
                <div className="flex flex-col gap-3 w-full mt-8">
                    <Link href="/terminal" className="w-full">
                        <NeonButton variant="cyan" className="w-full justify-center">
                            <Terminal className="w-4 h-4 mr-2" />
                            LAUNCH TERMINAL
                        </NeonButton>
                    </Link>

                    <a
                        href="https://wa.me/+1234567890?text=Hi%20OPOLL"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full"
                    >
                        <NeonButton variant="glass" className="w-full justify-center text-sm">
                            TRADE ON WHATSAPP
                        </NeonButton>
                    </a>
                </div>
            </motion.div>
        </section>
    );
}
