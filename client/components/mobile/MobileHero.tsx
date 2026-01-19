"use client";

import Link from "next/link";
import { Terminal, Send } from "lucide-react";
import NeonButton from "@/components/ui/NeonButton";
import { motion } from "framer-motion";
import HeroInteractive from "../landing/HeroInteractive";
import LogoBrand from "@/components/ui/LogoBrand";

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

                {/* LogoBrand - Same as Desktop */}
                <div className="flex flex-col items-center gap-4">
                    <LogoBrand size="lg" href="#" animate={false} />
                    <span className="text-2xl tracking-[0.3em] text-neon-cyan/80 font-heading font-bold mt-4">
                        PROTOCOL
                    </span>
                </div>

                <p className="text-text-secondary text-sm leading-relaxed max-w-xs">
                    The world's first <span className="text-white">WhatsApp + Telegram + Web3 Native</span> Prediction Market.
                </p>

                {/* Actions */}
                <div className="flex flex-col gap-3 w-full mt-8">
                    <Link href="/terminal" className="w-full">
                        <NeonButton variant="cyan" className="w-full justify-center">
                            <Terminal className="w-4 h-4 mr-2" />
                            JOIN POLL
                        </NeonButton>
                    </Link>

                    <a
                        href="https://t.me/opoll_predict_bot"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full"
                    >
                        <NeonButton variant="glass" className="w-full justify-center text-sm">
                            <Send className="w-4 h-4 mr-2" />
                            JOIN ON TELEGRAM
                        </NeonButton>
                    </a>
                </div>
            </motion.div>
        </section>
    );
}
