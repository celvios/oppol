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
        <div className="w-full pb-20 md:hidden overflow-x-hidden">
            <div className="flex items-center gap-2 mb-6 px-4">
                <TrendingUp className="w-5 h-5 text-neon-cyan" />
                <h2 className="text-xl font-heading font-bold">Trending Feed</h2>
            </div>

            <div className="flex overflow-x-auto snap-x snap-mandatory px-4 gap-4 pb-4 no-scrollbar">
                {markets.slice(0, 5).map((market) => (
                    <div key={market.id} className="min-w-[85vw] snap-center">
                        <Link href={`/terminal?marketId=${market.id}`} className="block h-full">
                            <GlassCard className="p-5 h-full active:scale-[0.98] transition-transform border border-white/5 active:border-outcome-a focus:border-outcome-a relative overflow-hidden group">

                                {/* Background Gradient Animation */}
                                <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                {/* Header Stats */}
                                <div className="flex justify-between text-xs text-text-secondary mb-3 font-mono relative z-10">
                                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> --</span>
                                    <span className="flex items-center gap-1.5 text-neon-green ml-auto font-bold tracking-wider">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-green opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-green"></span>
                                        </span>
                                        LIVE
                                    </span>
                                </div>

                                {/* Title */}
                                <h3 className="text-lg font-bold leading-snug mb-4 relative z-10 line-clamp-2 min-h-[3.5rem]">{market.question}</h3>

                                {/* Probability Bar */}
                                <div className="relative h-14 w-full bg-white/5 rounded-xl overflow-hidden flex font-mono text-sm font-bold border border-white/5 relative z-10">
                                    {/* YES */}
                                    <div
                                        style={{ width: `${market.yesOdds}%` }}
                                        className="h-full bg-outcome-a text-[#020408] flex items-center pl-4 transition-all duration-1000"
                                    >
                                        <div className="flex flex-col leading-none">
                                            <span className="text-xs opacity-70">YES</span>
                                            <span className="text-lg">{market.yesOdds.toFixed(0)}%</span>
                                        </div>
                                    </div>

                                    {/* NO */}
                                    <div
                                        className="flex-1 h-full bg-outcome-b text-[#020408] flex items-center justify-end pr-4"
                                    >
                                        <div className="flex flex-col leading-none items-end">
                                            <span className="text-xs opacity-70">NO</span>
                                            <span className="text-lg">{market.noOdds.toFixed(0)}%</span>
                                        </div>
                                    </div>

                                    {/* Center Divider */}
                                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-black/20 -translate-x-1/2" />
                                </div>

                                {/* Volume Footer */}
                                <div className="mt-4 flex justify-between items-center relative z-10">
                                    <span className="text-xs text-text-secondary bg-white/5 px-2 py-1 rounded-md">Vol: ${market.totalVolume}</span>
                                    <span className="text-xs font-bold text-neon-cyan flex items-center gap-1 bg-neon-cyan/10 px-3 py-1.5 rounded-full border border-neon-cyan/20">
                                        Trade Now <TrendingUp size={12} />
                                    </span>
                                </div>

                            </GlassCard>
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
}
