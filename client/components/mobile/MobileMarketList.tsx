"use client";

import { useState, useEffect, useRef } from "react";
import GlassCard from "@/components/ui/GlassCard";
import { TrendingUp, Users, Search } from "lucide-react";
import Link from "next/link";
import { web3MultiService as web3Service, MultiMarket } from "@/lib/web3-multi";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import BoostButton from "../market/BoostButton";
import FeaturedCarousel from "./FeaturedCarousel";

// Outcome colors for multi-outcome markets
const OUTCOME_COLORS = [
    "#27E8A7", // Green
    "#FF2E63", // Red/Coral
    "#00F0FF", // Cyan
    "#FFB800", // Gold
    "#9D4EDD", // Purple
    "#FF6B35", // Orange
];

const EMPTY_ARRAY: MultiMarket[] = [];

interface MobileMarketListProps {
    initialMarkets?: MultiMarket[];
}

export default function MobileMarketList({ initialMarkets = EMPTY_ARRAY }: MobileMarketListProps) {
    // Use server-provided data if available (SSR = instant load!)
    const [markets, setMarkets] = useState<MultiMarket[]>(initialMarkets);
    const [loading, setLoading] = useState(initialMarkets.length === 0);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Skip fetch if we already have initial data
        if (initialMarkets.length > 0) {
            const sorted = [...initialMarkets].sort((a, b) =>
                parseFloat(b.totalVolume) - parseFloat(a.totalVolume)
            );
            setMarkets(sorted);
            setLoading(false);
            return;
        }

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
    }, [initialMarkets]);

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

    const [searchQuery, setSearchQuery] = useState("");

    const filteredMarkets = markets.filter(m =>
        m.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.description || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return <div className="p-4"><SkeletonLoader /></div>;

    return (
        <div className="w-full pb-20 md:hidden overflow-x-hidden">
            {/* Search Bar */}
            <div className="px-4 mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search markets..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-neon-cyan/50 transition-colors"
                    />
                </div>
            </div>

            {/* Featured Carousel - Only show if no search query */}
            {!searchQuery && (
                <FeaturedCarousel markets={markets} />
            )}

            {/* Trending Feed - Only show if no search query */}
            {!searchQuery && (
                <>
                    <div className="flex items-center gap-2 mb-4 px-4">
                        <TrendingUp className="w-5 h-5 text-neon-cyan" />
                        <h2 className="text-xl font-heading font-bold">Trending Feed</h2>
                    </div>

                    <div
                        ref={scrollRef}
                        className="flex overflow-x-auto snap-x snap-mandatory px-4 gap-4 pb-4 no-scrollbar scroll-smooth mb-8"
                    >
                        {markets.slice(0, 6).map((market) => (
                            <MarketCard key={market.id} market={market} className="min-w-[85vw] snap-center h-full" />
                        ))}
                    </div>
                </>
            )}

            {/* All Markets List */}
            <div className="px-4">
                <div className="flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-neon-purple" />
                    <h2 className="text-xl font-heading font-bold">
                        {searchQuery ? "Search Results" : "All Markets"}
                    </h2>
                </div>

                <div className="space-y-4">
                    {filteredMarkets.length > 0 ? (
                        filteredMarkets.map((market) => (
                            <MarketCard key={`all-${market.id}`} market={market} className="w-full" />
                        ))
                    ) : (
                        <div className="text-center py-10 text-white/40">
                            No markets found matching "{searchQuery}"
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Extracted Card Component for reusability
function MarketCard({ market, className }: { market: MultiMarket, className?: string }) {
    const isMultiOutcome = (market.outcomes?.length || 0) > 2;
    const metadata = {
        image: market.image_url || '',
        description: market.description || '',
        category: market.category_id || 'General'
    };

    let leadingOutcome = market.outcomes?.[0] || "Yes";
    let leadingPrice = market.prices?.[0] || 50;
    if (isMultiOutcome && market.prices) {
        const maxIndex = market.prices.indexOf(Math.max(...market.prices));
        leadingOutcome = market.outcomes?.[maxIndex] || "Option";
        leadingPrice = market.prices[maxIndex];
    }

    return (
        <div className={className}>
            <Link href={`/trade?marketId=${market.id}`} className="block h-full">
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

                    {/* Market Image */}
                    <div className="relative z-10 h-24 w-full mb-3 rounded-lg overflow-hidden">
                        <img
                            src={metadata.image}
                            alt={market.question}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-void/80 to-transparent" />
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-bold leading-snug mb-4 relative z-10 line-clamp-2 min-h-[3.5rem]">{market.question}</h3>

                    {isMultiOutcome ? (
                        <div className="relative z-10">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-white/60">Leading:</span>
                                <span className="text-sm font-bold text-neon-green">{leadingOutcome} {Math.round(leadingPrice)}%</span>
                            </div>
                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden flex font-mono text-xs">
                                {market.prices?.map((price, i) => (
                                    <div
                                        key={i}
                                        style={{ width: `${price}%`, backgroundColor: OUTCOME_COLORS[i % OUTCOME_COLORS.length] }}
                                        className="h-full"
                                    />
                                ))}
                            </div>
                            <div className="mt-2 text-[10px] text-white/40 font-mono text-center">
                                {market.outcomes?.length} outcomes
                            </div>
                        </div>
                    ) : (
                        <div className="relative h-14 w-full bg-white/5 rounded-xl overflow-hidden flex font-mono text-sm font-bold border border-white/5 relative z-10">
                            <div
                                style={{ width: `${market.prices?.[0] || 50}%` }}
                                className="h-full bg-outcome-a text-[#020408] flex items-center pl-4 transition-all duration-1000"
                            >
                                <div className="flex flex-col leading-none">
                                    <span className="text-xs opacity-70">YES</span>
                                    <span className="text-lg">{(market.prices?.[0] || 50).toFixed(0)}%</span>
                                </div>
                            </div>
                            <div className="flex-1 h-full bg-outcome-b text-[#020408] flex items-center justify-end pr-4">
                                <div className="flex flex-col leading-none items-end">
                                    <span className="text-xs opacity-70">NO</span>
                                    <span className="text-lg">{(market.prices?.[1] || 50).toFixed(0)}%</span>
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

                    {/* Boost Button */}
                    <div className="absolute top-3 right-3 z-20" onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}>
                        <BoostButton marketId={market.id} isBoosted={market.isBoosted} />
                    </div>
                </GlassCard>
            </Link>
        </div>
    );
}
