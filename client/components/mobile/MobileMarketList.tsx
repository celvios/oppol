"use client";

import { useState, useEffect } from "react";
import GlassCard from "@/components/ui/GlassCard";
import { TrendingUp, Clock, Users } from "lucide-react";
import Link from "next/link";
import { web3Service } from "@/lib/web3"; // Corrected import path
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";

interface Market {
    id: number;
    question: string;
    yesOdds: number;
    noOdds: number;
    totalVolume: string;
    resolved: boolean;
    outcome: boolean;
}

export default function MobileMarketList() {
    const [markets, setMarkets] = useState<Market[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchMarkets() {
            try {
                // We'll use the existing service. 
                // Note: The file might be in @/lib/web3 or similar. 
                // Based on previous file reads, it's in `client/lib/web3.ts`.
                // Accessing via standard import.
                const data = await web3Service.getMarkets();
                setMarkets(data);
            } catch (e) {
                console.error("Failed to fetch markets", e);
            } finally {
                setLoading(false);
            }
        }
        fetchMarkets();
    }, []);

    if (loading) return <div className="p-4"><SkeletonLoader /></div>;

    return (
        <div className="w-full pb-20 md:hidden px-4">
            <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-5 h-5 text-neon-cyan" />
                <h2 className="text-xl font-heading font-bold">Trending Feed</h2>
            </div>

            <div className="flex flex-col gap-6">
                {markets.slice(0, 3).map((market) => (
                    <Link key={market.id} href={`/markets/${market.id}`} className="block">
                        <GlassCard className="p-5 active:scale-98 transition-transform border border-white/5 active:border-outcome-a focus:border-outcome-a">

                            {/* Header Stats */}
                            <div className="flex justify-between text-xs text-text-secondary mb-3 font-mono">
                                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> --</span>
                                <span className="flex items-center gap-1 text-outcome-a ml-auto"><Clock className="w-3 h-3" /> LIVE</span>
                            </div>

                            {/* Title */}
                            <h3 className="text-lg font-bold leading-snug mb-4">{market.question}</h3>

                            {/* Probability Bar */}
                            <div className="relative h-12 w-full bg-white/5 rounded-lg overflow-hidden flex font-mono text-sm font-bold">
                                {/* YES */}
                                <div
                                    style={{ width: `${market.yesOdds}%` }}
                                    className="h-full bg-outcome-a text-[#020408] flex items-center pl-3"
                                >
                                    {market.yesOdds.toFixed(0)}% YES
                                </div>

                                {/* NO */}
                                <div
                                    className="flex-1 h-full bg-outcome-b text-[#020408] flex items-center justify-end pr-3"
                                >
                                    {market.noOdds.toFixed(0)}% NO
                                </div>
                            </div>

                            {/* Volume Footer */}
                            <div className="mt-4 flex justify-between items-center">
                                <span className="text-xs text-text-secondary">Vol: ${market.totalVolume}</span>
                                <span className="text-xs font-bold text-neon-cyan">Trade Now &rarr;</span>
                            </div>

                        </GlassCard>
                    </Link>
                ))}
            </div>
        </div>
    );
}
