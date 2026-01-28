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
            <Link href={`/trade?marketId=${market.id}`} className="block w-full">
                <div className="flex items-center gap-4 p-3 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 active:scale-[0.99] transition-all relative overflow-hidden group">

                    {/* Compact Image Info */}
                    <div className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-black/50 border border-white/10">
                        {metadata.image ? (
                            <img
                                src={metadata.image}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-transparent">
                                <TrendingUp className="w-6 h-6 text-white/20" />
                            </div>
                        )}
                        {market.isBoosted && (
                            <div className="absolute top-0 right-0 p-1 bg-amber-500/90 text-black rounded-bl-lg">
                                <Sparkles className="w-2 h-2" />
                            </div>
                        )}
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] uppercase tracking-wider text-text-secondary bg-white/5 px-1.5 rounded-sm">
                                {metadata.category}
                            </span>
                            <span className="text-[10px] text-text-secondary font-mono">
                                ${market.totalVolume} Vol
                            </span>
                        </div>

                        <h3 className="text-sm font-bold leading-tight line-clamp-2 text-white/90 mb-2">
                            {market.question}
                        </h3>

                        {/* Minimalist Bar */}
                        {isMultiOutcome ? (
                            <div className="w-full flex items-center gap-2">
                                <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden flex">
                                    {market.prices?.map((price, i) => (
                                        <div
                                            key={i}
                                            style={{ width: `${price}%`, backgroundColor: OUTCOME_COLORS[i % OUTCOME_COLORS.length] }}
                                            className="h-full"
                                        />
                                    ))}
                                </div>
                                <span className="text-xs font-mono font-bold text-neon-green shrink-0">
                                    {Math.round(leadingPrice)}%
                                </span>
                            </div>
                        ) : (
                            <div className="w-full flex items-center gap-2">
                                <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden flex">
                                    <div
                                        className="h-full bg-outcome-a"
                                        style={{ width: `${market.prices?.[0] || 50}%` }}
                                    />
                                    <div
                                        className="h-full bg-outcome-b"
                                        style={{ width: `${market.prices?.[1] || 50}%` }}
                                    />
                                </div>
                                <span className="text-xs font-mono font-bold text-outcome-a shrink-0">
                                    {(market.prices?.[0] || 50).toFixed(0)}%
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Chevron / Action */}
                    <div className="shrink-0 text-white/20 group-hover:text-neon-cyan transition-colors">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                </div>
            </Link>
        </div>
    );
}

// Helper icons
import { Sparkles } from "lucide-react";
