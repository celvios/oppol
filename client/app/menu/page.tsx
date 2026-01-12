"use client";

import { useState } from "react";
import { User, Wallet, ChevronRight, Settings, ExternalLink, Shield, FileText, Home, PieChart } from "lucide-react";
import { useWallet } from "@/lib/use-wallet";
import { useWeb3Modal } from '@web3modal/wagmi/react';
import GlassCard from "@/components/ui/GlassCard";
import NeonButton from "@/components/ui/NeonButton";
import Link from "next/link";
import { Switch } from "@headlessui/react"; // Assuming headlessui is available or we build a simple switch

// Simple Custom Switch if HeadlessUI is not installed, to be safe.
function SimpleSwitch({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            className={`${enabled ? 'bg-neon-cyan' : 'bg-white/10'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
            onClick={() => onChange(!enabled)}
        >
            <span
                className={`${enabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
            />
        </button>
    );
}

export default function MenuPage() {
    const { isConnected, address } = useWallet();
    const { open } = useWeb3Modal();
    const [reduceMotion, setReduceMotion] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);

    // WALLET CONNECTION GATE
    if (!isConnected) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center -mt-20 p-6 text-center">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                    <Wallet className="w-8 h-8 text-white/50" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Connect Wallet</h2>
                <p className="text-white/50 mb-8 max-w-xs">
                    Connect your wallet to access your profile, portfolio, and settings.
                </p>
                <NeonButton
                    variant="cyan"
                    onClick={() => open()}
                    className="w-full max-w-xs"
                >
                    Connect Wallet
                </NeonButton>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-24 pt-8 px-4">
            <h1 className="text-3xl font-heading font-bold text-white mb-8">Menu</h1>

            {/* Profile Section */}
            <GlassCard className="p-6 mb-8 flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-white/10 to-white/5 text-white flex items-center justify-center border border-white/10">
                    <User size={32} />
                </div>
                <div className="flex-1 overflow-hidden">
                    <h3 className="font-mono text-lg font-bold text-white truncate">{address}</h3>
                    <button className="text-xs text-neon-cyan hover:underline mt-1">
                        View on Explorer
                    </button>
                </div>
            </GlassCard>

            {/* Navigation Links */}
            <div className="flex flex-col gap-6 mb-10">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest px-2 -mb-2">Navigation</h3>

                <Link href="/">
                    <GlassCard className="p-4 flex items-center justify-between active:scale-[0.98] transition-all">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white">
                                <Home size={16} />
                            </div>
                            <span className="font-medium text-white">Home</span>
                        </div>
                        <ChevronRight size={16} className="text-white/30" />
                    </GlassCard>
                </Link>

                <Link href="/terminal/portfolio">
                    <GlassCard className="p-4 flex items-center justify-between active:scale-[0.98] transition-all">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white">
                                <PieChart size={16} />
                            </div>
                            <span className="font-medium text-white">Portfolio</span>
                        </div>
                        <ChevronRight size={16} className="text-white/30" />
                    </GlassCard>
                </Link>
            </div>

            {/* Settings */}
            <div className="space-y-4 mb-8">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest px-2">Settings</h3>

                <GlassCard className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Settings size={18} className="text-white/60" />
                        <span className="text-white">Reduce Motion</span>
                    </div>
                    <SimpleSwitch enabled={reduceMotion} onChange={setReduceMotion} />
                </GlassCard>

                <GlassCard className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <User size={18} className="text-white/60" /> {/* Sound icon fallback */}
                        <span className="text-white">Sound Effects</span>
                    </div>
                    <SimpleSwitch enabled={soundEnabled} onChange={setSoundEnabled} />
                </GlassCard>
            </div>

            {/* Resources */}
            <div className="space-y-4">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest px-2">Support</h3>

                <a href="#" className="block">
                    <GlassCard className="p-4 flex items-center justify-between active:scale-[0.98]">
                        <div className="flex items-center gap-3">
                            <FileText size={18} className="text-white/60" />
                            <span className="text-white">Documentation</span>
                        </div>
                        <ExternalLink size={14} className="text-white/30" />
                    </GlassCard>
                </a>
                <a href="#" className="block">
                    <GlassCard className="p-4 flex items-center justify-between active:scale-[0.98]">
                        <div className="flex items-center gap-3">
                            <Shield size={18} className="text-white/60" />
                            <span className="text-white">Privacy Policy</span>
                        </div>
                        <ExternalLink size={14} className="text-white/30" />
                    </GlassCard>
                </a>
            </div>

            <div className="mt-12 text-center">
                <p className="text-white/20 text-xs font-mono">OPoll v1.0.0 (Beta)</p>
            </div>
        </div>
    );
}
