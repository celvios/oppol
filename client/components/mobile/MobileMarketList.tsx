"use client";

import { useState, useEffect, useRef } from "react";
import GlassCard from "@/components/ui/GlassCard";
import { TrendingUp, Users, Search, User, Clock } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { web3MultiService as web3Service, MultiMarket } from "@/lib/web3-multi";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import BoostButton from "../market/BoostButton";
import FeaturedCarousel from "./FeaturedCarousel";
import LogoBrand from "@/components/ui/LogoBrand";
import { Send, MessageCircle } from "lucide-react";

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



    const [searchQuery, setSearchQuery] = useState("");

    // Category state
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [categories, setCategories] = useState<string[]>(["All"]);

    // Fetch categories
    useEffect(() => {
        async function fetchCategories() {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL;
                if (apiUrl) {
                    const response = await fetch(`${apiUrl}/api/categories`);
                    const data = await response.json();
                    if (data.success && data.categories) {
                        const categoryNames = data.categories.map((cat: any) => cat.name);
                        setCategories(['All', 'Trending', 'New', ...categoryNames]);
                    } else {
                        setCategories(['All', 'Trending', 'New']);
                    }
                } else {
                    setCategories(['All', 'Trending', 'New']);
                }
            } catch (error) {
                console.error("Failed to fetch categories:", error);
                setCategories(['All', 'Trending', 'New']);
            }
        }
        fetchCategories();
    }, []);

    const filteredMarkets = (() => {
        // First apply search filter
        let result = markets.filter(m => {
            const matchesSearch = m.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (m.description || "").toLowerCase().includes(searchQuery.toLowerCase());
            return matchesSearch;
        });

        // Then apply category filter/sort
        if (selectedCategory === 'Trending') {
            // Sort by volume descending
            result = [...result].sort((a, b) => parseFloat(b.totalVolume) - parseFloat(a.totalVolume));
        } else if (selectedCategory === 'New') {
            // Filter markets created in last 24 hours
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            result = result
                .filter(m => m.created_at && new Date(m.created_at) > oneDayAgo)
                .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        } else if (selectedCategory !== 'All') {
            // Filter by regular category
            const category = (m: MultiMarket) => m.category_id || 'General';
            result = result.filter(m => category(m) === selectedCategory);
        }

        return result;
    })();

    if (loading) return <div className="p-4"><SkeletonLoader /></div>;

    return (
        <div className="w-full pb-20 md:hidden overflow-x-hidden">
            {/* Custom Header */}
            <div className="flex items-center justify-between px-4 pt-6 pb-4 mb-4">
                <LogoBrand size="sm" />
                <div className="flex items-center gap-4">
                    <a href="https://t.me/opoll_predict_bot" target="_blank" rel="noreferrer" className="text-white hover:text-neon-cyan transition-colors">
                        <Send className="w-5 h-5 -rotate-12" />
                    </a>
                    <button
                        onClick={() => alert("WhatsApp integration coming soon!")}
                        className="text-white hover:text-neon-green transition-colors"
                    >
                        <MessageCircle className="w-5 h-5" />
                    </button>
                    <a href="/docs" className="border border-white/20 px-2 py-0.5 rounded text-xs font-bold text-white hover:bg-white/10 transition-colors uppercase tracking-wide">
                        DOC
                    </a>
                    <Link href="/profile" className="text-white hover:text-neon-cyan transition-colors">
                        <User className="w-5 h-5" />
                    </Link>
                </div>
            </div>

            {/* Search Bar */}
            <div className="px-4 mb-4">
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

            {/* Featured Carousel - Only show if no search/category filter */}
            {!searchQuery && selectedCategory === "All" && (
                <FeaturedCarousel markets={markets} />
            )}

            {/* Category Filter (Horizontal Scroll) */}
            {!searchQuery && (
                <div className="flex overflow-x-auto px-4 gap-2 mb-6 no-scrollbar">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${selectedCategory === cat
                                ? "bg-white text-black"
                                : "bg-white/5 text-white/60 text-shadow-sm border border-white/5"
                                }`}
                        >
                            {cat === 'Trending' && <TrendingUp className="w-3 h-3 inline mr-1" />}
                            {cat}
                        </button>
                    ))}
                </div>
            )}

            {/* All Markets List (Bar Cards) */}
            <div className="px-4">
                <div className="flex items-center gap-2 mb-4 px-4">
                    {selectedCategory === 'Trending' ? (
                        <TrendingUp className="w-5 h-5 text-neon-cyan" />
                    ) : selectedCategory === 'New' ? (
                        <Clock className="w-5 h-5 text-neon-green" />
                    ) : (
                        <Users className="w-5 h-5 text-neon-purple" />
                    )}
                    <h2 className="text-xl font-heading font-bold">
                        {searchQuery
                            ? "Search Results"
                            : selectedCategory === 'All'
                                ? "All Markets"
                                : selectedCategory}
                    </h2>
                </div>

                <div className="space-y-3">
                    {filteredMarkets.length > 0 ? (
                        filteredMarkets.map((market) => (
                            <MarketCard key={`all-${market.id}`} market={market} className="w-full" />
                        ))
                    ) : (
                        <div className="text-center py-10 text-white/40">
                            No markets found matching filters
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ----------------------------------------------------------------------
// 1. Trending Market Card (Boxed Style - Restored)
// ----------------------------------------------------------------------
function TrendingMarketCard({ market, className }: { market: MultiMarket, className?: string }) {
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
            <Link href={`/trade?marketId=${market.id}`} className="block h-full">
                <GlassCard className="p-5 h-full active:scale-[0.98] transition-transform border border-white/5 active:border-outcome-a relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    {/* Header */}
                    <div className="flex justify-between text-xs text-text-secondary mb-3 font-mono relative z-10">
                        <div className="flex gap-2">
                            <span className="px-2 py-0.5 bg-white/10 rounded text-[10px]">{metadata.category}</span>
                            {/* Status Badge */}
                            {market.resolved ? (
                                <span className="px-2 py-0.5 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/20 rounded text-[10px] font-bold">
                                    RESOLVED
                                </span>
                            ) : (Date.now() / 1000) > (market.endTime || 0) ? (
                                <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded text-[10px] font-bold">
                                    ENDED
                                </span>
                            ) : null}
                        </div>
                        <span />
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

                    {/* Bar/Progress */}
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

// ----------------------------------------------------------------------
// 2. Main List Market Card (Bar Style - Compact)
// ----------------------------------------------------------------------
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
                            <div className="absolute top-0 right-0 p-1 bg-amber-500/90 text-black rounded-bl-lg z-10">
                                <Sparkles className="w-2 h-2" />
                            </div>
                        )}

                        {/* Status Overlay for Compact Card */}
                        {market.resolved ? (
                            <div className="absolute inset-0 bg-neon-cyan/80 flex items-center justify-center z-20 backdrop-blur-[1px]">
                                <span className="text-[8px] font-bold text-black uppercase">Resolved</span>
                            </div>
                        ) : (Date.now() / 1000) > (market.endTime || 0) ? (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 backdrop-blur-[1px] border border-orange-500/30">
                                <span className="text-[8px] font-bold text-orange-400 uppercase text-center px-1">Awaiting<br />Resolution</span>
                            </div>
                        ) : null}
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
            </Link >
        </div >
    );
}

// Helper icons
import { Sparkles } from "lucide-react";
