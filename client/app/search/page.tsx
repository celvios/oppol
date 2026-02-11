"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { Search, X, TrendingUp, Cpu, Globe, Zap, Tag } from "lucide-react";
import { web3Service } from "@/lib/web3";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import Link from "next/link";

// Lazy load heavy components
const GlassCard = lazy(() => import("@/components/ui/GlassCard"));
const AnimatePresence = lazy(() => import("framer-motion").then(m => ({ default: m.AnimatePresence })));
const motion = lazy(() => import("framer-motion").then(m => ({ default: m.motion })));

// Icon mapping for categories
const CATEGORY_ICONS: Record<string, any> = {
    'All': Zap,
    'Crypto': TrendingUp,
    'Tech': Cpu,
    'Culture': Globe,
};

interface Market {
    id: number;
    question: string;
    yesOdds: number;
    noOdds: number;
    totalVolume: string;
    image_url?: string;
}

interface CategoryFilter {
    id: string;
    label: string;
    icon: any;
}

export default function SearchPage() {
    const [query, setQuery] = useState("");
    const [activeFilter, setActiveFilter] = useState("all");
    const [markets, setMarkets] = useState<Market[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<CategoryFilter[]>([
        { id: 'all', label: 'All', icon: Zap }
    ]);

    // Fetch categories from API
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL;
                if (apiUrl) {
                    const response = await fetch(`${apiUrl}/api/categories`);
                    const data = await response.json();
                    if (data.success && data.categories) {
                        const categoryFilters: CategoryFilter[] = [
                            { id: 'all', label: 'All', icon: Zap }
                        ];

                        data.categories.forEach((cat: any) => {
                            categoryFilters.push({
                                id: (cat.name || "").toLowerCase(),
                                label: cat.name || "Unknown",
                                icon: CATEGORY_ICONS[cat.name] || Tag
                            });
                        });

                        setFilters(categoryFilters);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch categories:", error);
            }
        };
        fetchCategories();
    }, []);

    useEffect(() => {
        const fetchMarkets = async () => {
            try {
                const data = await web3Service.getMarkets();
                setMarkets(data);
            } catch (error) {
                console.error("Failed to fetch markets:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchMarkets();
    }, []);

    const filteredMarkets = markets.filter(m => {
        const matchesSearch = (m.question || "").toLowerCase().includes(query.toLowerCase());
        let matchesCategory = true;
        if (activeFilter === 'crypto') matchesCategory = /BTC|ETH|Bitcoin|Ethereum|Solana/i.test(m.question);
        if (activeFilter === 'tech') matchesCategory = /AI|GPT|SpaceX|Nvidia|Apple/i.test(m.question);
        if (activeFilter === 'culture') matchesCategory = /Election|Swift|Drake|GTA/i.test(m.question);
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="min-h-screen pb-24 pt-8 px-4">
            <h1 className="text-3xl font-heading font-bold text-white mb-6">Find Markets</h1>

            <div className="relative mb-6 group">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search markets..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-12 text-lg text-white placeholder:text-white/30 focus:outline-none focus:border-neon-cyan/50 transition-all"
                    autoFocus
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={24} />
                {query && (
                    <button onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 bg-white/10 rounded-full">
                        <X size={14} className="text-white" />
                    </button>
                )}
            </div>

            <div className="flex gap-3 mb-8 overflow-x-auto pb-2 -mx-4 px-4">
                {filters.map((filter) => {
                    const Icon = filter.icon;
                    const isActive = activeFilter === filter.id;
                    return (
                        <button
                            key={filter.id}
                            onClick={() => setActiveFilter(filter.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all whitespace-nowrap ${isActive ? 'bg-neon-cyan/10 border-neon-cyan text-neon-cyan' : 'bg-white/5 border-white/10 text-text-secondary'
                                }`}
                        >
                            <Icon size={14} />
                            <span className="text-sm font-medium">{filter.label}</span>
                        </button>
                    )
                })}
            </div>

            <div className="space-y-4">
                {loading ? (
                    Array(3).fill(0).map((_, i) => <SkeletonLoader key={i} />)
                ) : filteredMarkets.length > 0 ? (
                    <Suspense fallback={<SkeletonLoader />}>
                        {filteredMarkets.map((m) => {
                            // Icon Logic
                            let MarketIcon = Zap;
                            if (/BTC|ETH|Bitcoin|Ethereum|Solana|Crypto/i.test(m.question)) MarketIcon = TrendingUp;
                            else if (/AI|GPT|Intel|Nvidia|Tech/i.test(m.question)) MarketIcon = Cpu;
                            else if (/Election|Vote|Politics|War/i.test(m.question)) MarketIcon = Globe;

                            return (
                                <Link key={m.id} href={`/?marketId=${m.id}`}>
                                    <GlassCard className="p-4 active:scale-[0.98] transition-all hover:bg-white/10">
                                        <div className="flex justify-between items-start mb-3 gap-4">
                                            <div className="flex items-start gap-3">
                                                {/* Market Image */}
                                                <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:border-neon-cyan/50 transition-colors overflow-hidden">
                                                    <img
                                                        src={m.image_url || ''}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                            e.currentTarget.parentElement?.classList.add('bg-neon-cyan/10');
                                                        }}
                                                    />
                                                </div>
                                                <h4 className="text-base font-medium text-white line-clamp-2 pt-1">{m.question}</h4>
                                            </div>
                                            <span className={`font-mono text-sm font-bold whitespace-nowrap ${m.yesOdds >= 50 ? 'text-outcome-a' : 'text-outcome-b'}`}>
                                                {m.yesOdds.toFixed(0)}% Chance
                                            </span>
                                        </div>
                                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden flex ml-13 pl-[52px]">
                                            <div style={{ width: `${m.yesOdds}%` }} className="h-full bg-outcome-a" />
                                            <div style={{ width: `${m.noOdds}%` }} className="h-full bg-outcome-b" />
                                        </div>
                                        <div className="flex justify-between items-center mt-3 text-xs text-text-secondary pl-[52px]">
                                            <span>${parseFloat(m.totalVolume).toLocaleString()} Vol</span>
                                            <span className="flex items-center gap-1">Trade <TrendingUp size={10} /></span>
                                        </div>
                                    </GlassCard>
                                </Link>
                            );
                        })}
                    </Suspense>
                ) : (
                    <div className="text-center py-20 text-white/30">
                        <Search size={48} className="mx-auto mb-4 opacity-50" />
                        <p>No markets found for "{query}"</p>
                    </div>
                )}
            </div>
        </div>
    );
}
