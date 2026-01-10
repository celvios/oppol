"use client";

import { Zap, Globe, Shield } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";

const FEATURES = [
    {
        icon: Zap,
        color: "text-neon-cyan",
        bg: "bg-neon-cyan/10",
        title: "Lightning Fast",
        desc: "Execute trades in milliseconds on our high-freq engine."
    },
    {
        icon: Globe,
        color: "text-neon-coral",
        bg: "bg-neon-coral/10",
        title: "Global Access",
        desc: "Trade from anywhere via WhatsApp text."
    },
    {
        icon: Shield,
        color: "text-neon-green",
        bg: "bg-neon-green/10",
        title: "Decentralized",
        desc: "Your funds, your keys. Audited smart contracts."
    }
];

export default function MobileFeatures() {
    return (
        <div className="w-full py-16 md:hidden overflow-x-hidden">
            <h2 className="text-2xl font-heading font-bold text-center mb-8">Why Vantage?</h2>

            <div className="flex overflow-x-auto snap-x snap-mandatory px-6 gap-4 pb-8 no-scrollbar">
                {FEATURES.map((feat, i) => {
                    const Icon = feat.icon;
                    return (
                        <div key={i} className="min-w-[85vw] snap-center">
                            <GlassCard className="p-6 h-full flex flex-col items-center text-center relative overflow-hidden">
                                <div className={`absolute top-0 right-0 w-24 h-24 ${feat.bg} blur-2xl rounded-full -mr-10 -mt-10`} />
                                <Icon className={`w-10 h-10 ${feat.color} mb-4`} />
                                <h3 className="text-lg font-bold mb-2">{feat.title}</h3>
                                <p className="text-sm text-text-secondary leading-relaxed">{feat.desc}</p>
                            </GlassCard>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
