"use client";

import Link from "next/link";
import { Terminal, Send, MessageCircle } from "lucide-react";
import NeonButton from "@/components/ui/NeonButton";
import { motion } from "framer-motion";
import HeroInteractive from "../landing/HeroInteractive";

export default function MobileHero() {
    return (
        <section className="relative min-h-[90vh] flex flex-col items-center justify-center p-6 pt-20 text-center overflow-hidden md:hidden">
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

                {/* OPoll Branding */}
                <h1 className="text-6xl font-heading font-bold tracking-tighter leading-[0.9] cursor-default flex flex-col items-center">
                    <span className="block">
                        <span className="text-neon-cyan drop-shadow-[0_0_30px_rgba(0,224,255,0.5)]">O</span>
                        <span className="text-white">Poll</span>
                    </span>
                    <span className="text-neon-cyan/80 block text-lg tracking-[0.2em] mt-2 font-mono font-normal">
                        PREDICTION MARKET
                    </span>
                </h1>

                <p className="text-text-secondary text-sm leading-relaxed max-w-xs">
                    The world’s first <span className="text-white">Web + Telegram + Whatsapp native</span> prediction market.
                </p>


                {/* Actions */}
                <div className="flex flex-col gap-3 w-full mt-8">
                    <Link href="/terminal" className="w-full">
                        <NeonButton variant="cyan" className="w-full justify-center">
                            <Terminal className="w-4 h-4 mr-2" />
                            JOIN POLL
                        </NeonButton>
                    </Link>

                    <button
                        disabled
                        className="w-full px-4 py-3 text-sm font-heading font-medium tracking-wide flex items-center justify-center gap-2 rounded-lg transition-all duration-300 bg-[#25D366] text-white shadow-[0_0_20px_rgba(37,211,102,0.4)] hover:shadow-[0_0_30px_rgba(37,211,102,0.6)] opacity-80 cursor-not-allowed"
                    >
                        <MessageCircle className="w-4 h-4" />
                        JOIN ON WHATSAPP - COMING SOON
                    </button>

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
