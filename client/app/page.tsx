"use client";

import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-white relative overflow-hidden flex flex-col items-center justify-center">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-success/5 blur-[120px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="z-10 text-center max-w-2xl px-4"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-primary text-xs font-mono mb-8 uppercase tracking-widest">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          System Online
        </div>

        <h1 className="text-6xl md:text-7xl font-bold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
          OPOLL
        </h1>

        <p className="text-xl text-white/60 mb-10 leading-relaxed font-light">
          The world's first <span className="text-white font-medium">WhatsApp-Native</span> Prediction Market.
          Trade on information directly from your chat, or access the professional terminal for deep analytics.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/terminal"
            className="group flex items-center gap-3 bg-white text-black px-8 py-4 rounded-full font-bold transition-all hover:scale-105 active:scale-95 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]"
          >
            Launch Terminal
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </Link>

          <a
            href="https://wa.me/+1234567890?text=Hi%20OPOLL"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-8 py-4 rounded-full border border-white/10 hover:bg-white/5 transition-colors text-white/80"
          >
            <MessageCircle className="w-5 h-5" />
            Trade via WhatsApp
          </a>
        </div>
      </motion.div>

      {/* Footer */}
      <div className="absolute bottom-8 text-white/20 text-xs font-mono uppercase tracking-widest">
        Secured by BNB Chain • Powered by BSC
      </div>
    </div>
  );
}
