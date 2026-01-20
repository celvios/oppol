"use client";

import Link from "next/link";
import { ArrowRight, MessageCircle, Terminal, Zap, Globe, Shield, Send } from "lucide-react";
import { motion } from "framer-motion";
import dynamic from 'next/dynamic';
import NeonButton from "@/components/ui/NeonButton";
import GlassCard from "@/components/ui/GlassCard";
import MarketGrid from "@/components/market/MarketGrid";
import ScrambleText from "@/components/ui/ScrambleText";
import ScrollReveal from "@/components/ui/ScrollReveal";
import MobileHero from "@/components/mobile/MobileHero";
import MobileFeatures from "@/components/mobile/MobileFeatures";
import MobileMarketList from "@/components/mobile/MobileMarketList";

// Dynamically load Interactive component with no SSR (though Framer Motion works in SSR, dynamic is safe for layout)
const HeroInteractive = dynamic(() => import('@/components/landing/HeroInteractive'), { ssr: false });
const MarketTicker = dynamic(() => import('@/components/landing/MarketTicker'), { ssr: false });

export default function Home() {
  return (
    <div className="min-h-screen bg-void text-white relative overflow-x-hidden">

      {/* Hero Section */}
      <MobileHero />
      <div className="relative min-h-screen hidden md:flex flex-col items-center justify-center pt-20 overflow-hidden">
        {/* Interactive Background Layer */}
        <div className="absolute inset-0 z-0">
          <HeroInteractive />
        </div>



        {/* Content Layer - Centered */}
        <div className="relative z-20 w-full max-w-5xl mx-auto px-6 flex flex-col items-center text-center">

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8 hover:bg-white/10 transition-colors cursor-default">
              <span className="w-2 h-2 rounded-full bg-outcome-a animate-pulse" />
              <span className="text-xs font-mono font-bold tracking-[0.2em] text-outcome-a">SYSTEM ONLINE</span>
            </div>

            <h1 className="text-7xl md:text-8xl lg:text-9xl font-heading font-bold tracking-tighter mb-6 leading-[0.9] cursor-default flex flex-col items-center">
              <span className="block">
                <span className="text-neon-cyan drop-shadow-[0_0_30px_rgba(0,224,255,0.5)]">O</span>
                <span className="text-white">Poll</span>
              </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-white/20 block text-4xl md:text-5xl lg:text-6xl tracking-[0.5em] mt-4">
                PROTOCOL
              </span>
            </h1>

            <p className="text-lg md:text-xl text-text-secondary mb-12 leading-relaxed max-w-2xl font-light">
              The world's first <span className="text-white font-medium">WhatsApp + Telegram + Web3 Native</span> Prediction Market.
            </p>

            <div className="flex flex-col sm:flex-row gap-5 w-full sm:w-auto justify-center">
              <Link href="/terminal" className="w-full sm:w-auto">
                <NeonButton variant="cyan" className="w-full sm:w-auto px-8 py-5 text-lg group">
                  <Terminal className="w-5 h-5 mr-2 group-hover:text-black transition-colors" />
                  JOIN POLL
                </NeonButton>
              </Link>

              <button
                disabled
                className="w-full sm:w-auto px-8 py-5 text-lg font-heading font-medium tracking-wide flex items-center justify-center gap-2 rounded-lg transition-all duration-300 bg-[#25D366] text-white shadow-[0_0_20px_rgba(37,211,102,0.4)] hover:shadow-[0_0_30px_rgba(37,211,102,0.6)] opacity-80 cursor-not-allowed"
              >
                <MessageCircle className="w-5 h-5" />
                JOIN ON WHATSAPP - COMING SOON
              </button>

              <a
                href="https://t.me/opoll_predict_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto"
              >
                <NeonButton variant="glass" className="w-full sm:w-auto px-8 py-5 text-lg group">
                  <Send className="w-5 h-5 mr-2 text-neon-cyan" />
                  JOIN ON TELEGRAM
                </NeonButton>
              </a>
            </div>
          </motion.div>

        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce opacity-50 z-20">
          <div className="w-6 h-10 rounded-full border-2 border-white flex justify-center pt-2">
            <div className="w-1 h-3 bg-white rounded-full" />
          </div>
        </div>
      </div>



      {/* Features Section */}
      <section className="py-24 relative z-10 w-full max-w-7xl mx-auto px-6">
        {/* Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-neon-cyan/5 rounded-full blur-[120px] -z-10 pointer-events-none" />

        <ScrollReveal>
          <div className="text-center mb-16">
            <span className="text-neon-cyan font-mono text-sm tracking-widest uppercase mb-4 block">Why OPoll?</span>
            <h2 className="text-4xl md:text-5xl font-heading font-bold">The Future of Prediction</h2>
          </div>
        </ScrollReveal>

        <MobileFeatures />

        <div className="hidden md:grid grid-cols-1 md:grid-cols-3 gap-8">
          <ScrollReveal delay={0.1}>
            <GlassCard className="p-8 hover:border-neon-cyan/50 transition-colors group relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-neon-cyan/10 rounded-full blur-2xl group-hover:bg-neon-cyan/20 transition-colors" />
              <Zap className="w-12 h-12 text-neon-cyan mb-6 group-hover:scale-110 transition-transform duration-300" />
              <h3 className="text-xl font-bold mb-4">Lightning Fast</h3>
              <p className="text-text-secondary">Execute trades in milliseconds. Our high-frequency engine ensures you never miss a beat.</p>
            </GlassCard>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <GlassCard className="p-8 hover:border-neon-coral/50 transition-colors group relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-neon-coral/10 rounded-full blur-2xl group-hover:bg-neon-coral/20 transition-colors" />
              <Globe className="w-12 h-12 text-neon-coral mb-6 group-hover:scale-110 transition-transform duration-300" />
              <h3 className="text-xl font-bold mb-4">Global Access</h3>
              <p className="text-text-secondary">Trade from anywhere, on any device. WhatsApp integration means you can trade via simple text.</p>
            </GlassCard>
          </ScrollReveal>

          <ScrollReveal delay={0.3}>
            <GlassCard className="p-8 hover:border-neon-green/50 transition-colors group relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-neon-green/10 rounded-full blur-2xl group-hover:bg-neon-green/20 transition-colors" />
              <Shield className="w-12 h-12 text-neon-green mb-6 group-hover:scale-110 transition-transform duration-300" />
              <h3 className="text-xl font-bold mb-4">Fully Decentralized</h3>
              <p className="text-text-secondary">Your funds, your keys. Smart contracts audit every transaction for complete transparency.</p>
            </GlassCard>
          </ScrollReveal>
        </div>
      </section>

      {/* Live Markets Preview */}
      <section className="py-24 relative z-10">
        <div className="w-full max-w-7xl mx-auto px-6 relative z-10">
          <ScrollReveal>
            <div className="flex justify-between items-end mb-12">
              <div>
                <h2 className="text-4xl font-heading font-bold mb-4">Trending Markets</h2>
                <p className="text-text-secondary max-w-xl">See what the world is predicting right now.</p>
              </div>
              <Link href="/markets">
                <NeonButton variant="glass">View All Markets <ArrowRight className="w-4 h-4 ml-2" /></NeonButton>
              </Link>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <MobileMarketList />
            <div className="hidden md:block">
              <MarketGrid limit={6} showFilters={false} />
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 relative z-10">
        <ScrollReveal>
          <div className="w-full max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-2xl font-heading font-bold text-center mb-8">
              <span className="text-neon-cyan">O</span><span className="text-white">Poll</span>
            </h2>
            <div className="flex justify-center gap-8 mb-8 text-text-secondary">
              <a href="#" className="hover:text-neon-cyan transition-colors transform hover:-translate-y-1 inline-block">Twitter</a>
              <a href="#" className="hover:text-neon-cyan transition-colors transform hover:-translate-y-1 inline-block">Discord</a>
              <a href="#" className="hover:text-neon-cyan transition-colors transform hover:-translate-y-1 inline-block">Docs</a>
            </div>
            <span className="text-white/20 text-xs font-mono uppercase tracking-[0.3em]">Secured by BNB Chain • Powered by OPoll Engine</span>
          </div>
        </ScrollReveal>
      </footer>

    </div>
  );
}
