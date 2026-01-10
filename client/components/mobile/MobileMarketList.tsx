"use client";

import GlassCard from "@/components/ui/GlassCard";
import { TrendingUp, Clock, Users } from "lucide-react";
import Link from "next/link";

const MARKETS = [
    { id: "btc-100k", title: "Will Bitcoin hit $100k before 2026?", volume: "$12.5M", probA: 0.65, probB: 0.35, outcomeA: "Yes", outcomeB: "No" },
    { id: "gta-6", title: "GTA VI Release date confirmed for 2025?", volume: "$3.2M", probA: 0.85, probB: 0.15, outcomeA: "Yes", outcomeB: "No" },
    { id: "fed-rate", title: "Fed Interest Rate Cut in March?", volume: "$45M", probA: 0.30, probB: 0.70, outcomeA: "Cut", outcomeB: "Hold" },
    { id: "election-us", title: "US Election: Party Winner?", volume: "$102M", probA: 0.48, probB: 0.52, outcomeA: "Dem", outcomeB: "Rep" },
];

export default function MobileMarketList() {
    return (
        <div className="w-full pb-20 md:hidden px-4">
            <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-5 h-5 text-neon-cyan" />
                <h2 className="text-xl font-heading font-bold">Trending Feed</h2>
            </div>

            <div className="flex flex-col gap-6">
                {MARKETS.map((market) => (
                    <Link key={market.id} href={`/markets/${market.id}`} className="block">
                        <GlassCard className="p-5 active:scale-98 transition-transform border border-white/5 active:border-[#4ADE80] focus:border-[#4ADE80]">

                            {/* Header Stats */}
                            <div className="flex justify-between text-xs text-text-secondary mb-3 font-mono">
                                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> 2.4k</span>
                                <span className="flex items-center gap-1 text-[#4ADE80] ml-auto"><Clock className="w-3 h-3" /> LIVE</span>
                            </div>

                            {/* Title */}
                            <h3 className="text-lg font-bold leading-snug mb-4">{market.title}</h3>

                            {/* Probability Bar */}
                            <div className="relative h-12 w-full bg-white/5 rounded-lg overflow-hidden flex font-mono text-sm font-bold">
                                {/* YES / A */}
                                <div
                                    style={{ width: `${market.probA * 100}%` }}
                                    className="h-full bg-[#4ADE80] text-[#020408] flex items-center pl-3"
                                >
                                    {market.probA * 100}% {market.outcomeA}
                                </div>

                                {/* NO / B */}
                                <div
                                    className="flex-1 h-full bg-[#F87171] text-[#020408] flex items-center justify-end pr-3"
                                >
                                    {market.probB * 100}% {market.outcomeB}
                                </div>
                            </div>

                            {/* Volume Footer */}
                            <div className="mt-4 flex justify-between items-center">
                                <span className="text-xs text-text-secondary">Vol: {market.volume}</span>
                                <span className="text-xs font-bold text-neon-cyan">Trade Now &rarr;</span>
                            </div>

                        </GlassCard>
                    </Link>
                ))}
            </div>
        </div>
    );
}
