"use client";

import { useState, useEffect, useRef } from "react";
import GlassCard from "@/components/ui/GlassCard";
import { TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { web3Service, Market } from "@/lib/web3";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { getMultiMarketMetadata, getMarketMetadata } from "@/lib/market-metadata";

// Outcome colors for multi-outcome markets
const OUTCOME_COLORS = [
    "#27E8A7", // Green
    "#FF2E63", // Red/Coral
    "#00F0FF", // Cyan
    "#FFB800", // Gold
    "#9D4EDD", // Purple
    "#FF6B35", // Orange
];

export default function MobileMarketList() {
    const [markets, setMarkets] = useState<Market[]>([]);
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function fetchMarkets() {
            try {
                const data = await web3Service.getMarkets();
                // Sort by volume descending
                const sorted = [...data].sort((a, b) =>
                    parseFloat(b.totalVolume) - parseFloat(a.totalVolume)
                );
                setMarkets(sorted);
            } catch (e) {
                console.error("Failed to fetch markets", e);
            } finally {
                setLoading(false);
            }
        }
        fetchMarkets();
    }, []);

    // Auto-scroll effect
    useEffect(() => {
        const interval = setInterval(() => {
            if (scrollRef.current) {
                const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
                if (scrollLeft + clientWidth >= scrollWidth - 10) {
                    scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    scrollRef.current.scrollBy({ left: clientWidth * 0.85, behavior: 'smooth' });
                }
            }
        }, 4000);

        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="p-4"><SkeletonLoader /></div>;

    return (
        <div className="w-full pb-20 md:hidden overflow-x-hidden">
            <div className="flex items-center gap-2 mb-6 px-4">
                <TrendingUp className="w-5 h-5 text-neon-cyan" />
                <h2 className="text-xl font-heading font-bold">Trending Feed</h2>
            </div>

            <div
                ref={scrollRef}
                className="flex overflow-x-auto snap-x snap-mandatory px-4 gap-4 pb-4 no-scrollbar scroll-smooth"
            >
                {markets.slice(0, 6).map((market) => {
                    const isMultiOutcome = (market.outcomes?.length || 0) > 2;
                    const metadata = getMultiMarketMetadata(market.question, market.id) || getMarketMetadata(market.question, market.id);

                    // Find leading outcome for multi-outcome
                    let leadingOutcome = market.outcomes?.[0] || "Yes";
                    let leadingPrice = market.prices?.[0] || market.yesOdds;
                    if (isMultiOutcome && market.prices) {
                        const maxIndex = market.prices.indexOf(Math.max(...market.prices));
                        leadingOutcome = market.outcomes?.[maxIndex] || "Option";
                        leadingPrice = market.prices[maxIndex];
                    }

                    return (
                        <div key={market.id} className="min-w-[85vw] snap-center">
                            <Link href={`/terminal?marketId=${market.id}`} className="block h-full">
                                <GlassCard className="p-5 h-full active:scale-[0.98] transition-transform border border-white/5 active:border-outcome-a relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                    {/* Header */}
                                    <div className="flex justify-between text-xs text-text-secondary mb-3 font-mono relative z-10">
                                        <span className="px-2 py-0.5 bg-white/10 rounded text-[10px]">{metadata.category}</span>
                                        <span className="flex items-center gap-1.5 text-neon-green font-bold tracking-wider">
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-green opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-green"></span>
                                            </span>
                                            LIVE
                                        </span>
                                    </div>

                                    {/* Title */}
                                    <h3 className="text-lg font-bold leading-snug mb-4 relative z-10 line-clamp-2 min-h-[3.5rem]">{market.question}</h3>

                                    {isMultiOutcome ? (
                                        /* Multi-outcome display */
                                        <div className="relative z-10">
                                            {/* Leading outcome */}
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs text-white/60">Leading:</span>
                                                <span className="text-sm font-bold text-neon-green">{leadingOutcome} {Math.round(leadingPrice)}%</span>
                                            </div>

                                            {/* Multi-outcome bar */}
                                            <div className="h-10 w-full bg-white/5 rounded-xl overflow-hidden flex font-mono text-xs border border-white/5">
                                                {market.prices?.map((price, i) => (
                                                    <div
                                                        key={i}
                                                        style={{
                                                            width: `${price}%`,
                                                            backgroundColor: OUTCOME_COLORS[i % OUTCOME_COLORS.length],
                                                            minWidth: price > 0 ? '2px' : '0'
                                                        }}
                                                        className="h-full flex items-center justify-center text-[#020408] font-bold overflow-hidden"
                                                    >
                                                        {price >= 15 && <span>{Math.round(price)}%</span>}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Outcome count */}
                                            <div className="mt-2 text-[10px] text-white/40 font-mono text-center">
                                                {market.outcomes?.length} outcomes
                                            </div>
                                        </div>
                                    ) : (
                                        /* Binary YES/NO display */
                                        <div className="relative h-14 w-full bg-white/5 rounded-xl overflow-hidden flex font-mono text-sm font-bold border border-white/5 relative z-10">
                                            <div
                                                style={{ width: `${market.yesOdds}%` }}
                                                className="h-full bg-outcome-a text-[#020408] flex items-center pl-4 transition-all duration-1000"
                                            >
                                                <div className="flex flex-col leading-none">
                                                    <span className="text-xs opacity-70">YES</span>
                                                    <span className="text-lg">{market.yesOdds.toFixed(0)}%</span>
                                                </div>
                                            </div>
                                            <div className="flex-1 h-full bg-outcome-b text-[#020408] flex items-center justify-end pr-4">
                                                <div className="flex flex-col leading-none items-end">
                                                    <span className="text-xs opacity-70">NO</span>
                                                    <span className="text-lg">{market.noOdds.toFixed(0)}%</span>
                                                </div>
                                            </div>
                                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-black/20 -translate-x-1/2" />
                                        </div>
                                    )}

                                    {/* Volume Footer */}
                                    <div className="mt-4 flex justify-between items-center relative z-10">
                                        <span className="text-xs text-text-secondary bg-white/5 px-2 py-1 rounded-md">Vol: ${market.totalVolume}</span>
                                        <span className="text-xs font-bold text-neon-cyan flex items-center gap-1 bg-neon-cyan/10 px-3 py-1.5 rounded-full border border-neon-cyan/20">
                                            Join Poll <TrendingUp size={12} />
                                        </span>
                                    </div>
                                </GlassCard>
                            </Link>
                        </div>
                    );
                })}
            </div>

            {/* All Markets List */}
            <div className="mt-8 px-4">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-neon-purple" />
                    <h2 className="text-xl font-heading font-bold">All Markets</h2>
                </div>

                <div className="space-y-4">
                    {markets.map((market) => {
                        const isMultiOutcome = (market.outcomes?.length || 0) > 2;
                        const metadata = getMultiMarketMetadata(market.question, market.id) || getMarketMetadata(market.question, market.id);

                        let leadingOutcome = "Yes";
                        let leadingPrice = market.yesOdds;
                        if (isMultiOutcome && market.prices) {
                            const maxIndex = market.prices.indexOf(Math.max(...market.prices));
                            leadingOutcome = market.outcomes?.[maxIndex] || "Option";
                            leadingPrice = market.prices[maxIndex];
                        }

                        return (
                            <Link key={market.id} href={`/terminal?marketId=${market.id}`} className="block">
                                <GlassCard className="p-4 active:scale-[0.98] transition-transform border border-white/5 flex items-center gap-4">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-sm mb-2 line-clamp-2">{market.question}</h3>
                                        <div className="flex items-center gap-3 text-xs font-mono">
                                            {isMultiOutcome ? (
                                                <>
                                                    <span className="text-neon-green">{leadingOutcome} {Math.round(leadingPrice)}%</span>
                                                    <span className="text-white/30">{market.outcomes?.length} outcomes</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="text-outcome-a">YES {market.yesOdds.toFixed(0)}%</span>
                                                    <span className="text-outcome-b">NO {market.noOdds.toFixed(0)}%</span>
                                                </>
                                            )}
                                            <span className="text-white/30">Vol: ${market.totalVolume}</span>
                                        </div>
                                    </div>
                                    <div className="bg-white/5 p-2 rounded-lg">
                                        <TrendingUp className="w-4 h-4 text-neon-cyan" />
                                    </div>
                                </GlassCard>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
