"use client";

import Link from "next/link";
import { Terminal } from "lucide-react";
import NeonButton from "@/components/ui/NeonButton";
import ScrambleText from "@/components/ui/ScrambleText";
import { motion } from "framer-motion";
import HeroInteractive from "../landing/HeroInteractive";

export default function MobileHero() {
    return (
        <section className="relative min-h-[90vh] flex flex-col items-center justify-center p-6 text-center overflow-hidden md:hidden">
            {/* Background Decor - Interactive */}
            <div className="absolute inset-0 z-0">
                <HeroInteractive isMobile={true} />
            </div>

            {/* Overlay Gradient to ensure text readability */}
            <div className="absolute inset-0 z-0 bg-gradient-to-b from-void/20 via-void/50 to-void pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="flex flex-col items-center gap-6 z-10"
            >
                {/* Status Pill */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md relative overflow-hidden">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-outcome-a opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-outcome-a"></span>
                    </span>
                    <span className="text-[10px] font-mono font-bold tracking-widest text-outcome-a">LIVE</span>
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
