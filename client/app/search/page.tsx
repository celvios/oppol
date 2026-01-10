"use client";

import { useState, useEffect } from "react";
import { Search, X, TrendingUp, Cpu, Globe, Zap } from "lucide-react";
import { web3Service } from "@/lib/web3"; // Removed Market import if it doesn't exist
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import GlassCard from "@/components/ui/GlassCard";
import NeonButton from "@/components/ui/NeonButton";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const FILTERS = [
    { id: 'all', label: 'All', icon: Zap },
    { id: 'crypto', label: 'Crypto', icon: TrendingUp },
    { id: 'tech', label: 'Tech', icon: Cpu },
    { id: 'culture', label: 'Culture', icon: Globe },
];

interface Market {
    id: number;
    question: string;
    yesOdds: number;
    noOdds: number;
    totalVolume: string;
}

export default function SearchPage() {
    const [query, setQuery] = useState("");
    const [activeFilter, setActiveFilter] = useState("all");
    const [markets, setMarkets] = useState<Market[]>([]);
    const [loading, setLoading] = useState(true);

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

    // Filter Logic
    const filteredMarkets = markets.filter(m => {
        const matchesSearch = m.question.toLowerCase().includes(query.toLowerCase());

        // Mock Category Logic - In real app, markets would have a 'category' field.
        // For now, we simple text match keywords for categories
        let matchesCategory = true;
        if (activeFilter === 'crypto') matchesCategory = /BTC|ETH|Bitcoin|Ethereum|Solana/i.test(m.question);
        if (activeFilter === 'tech') matchesCategory = /AI|GPT|SpaceX|Nvidia|Apple/i.test(m.question);
        if (activeFilter === 'culture') matchesCategory = /Election|Swift|Drake|GTA/i.test(m.question);

        return matchesSearch && matchesCategory;
    });

    return (
        <div className="min-h-screen pb-24 pt-8 px-4">
            <h1 className="text-3xl font-heading font-bold text-white mb-6">Find Markets</h1>

            {/* Search Input */}
            <div className="relative mb-6 group">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search markets..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-12 text-lg text-white placeholder:text-white/30 focus:outline-none focus:border-neon-cyan/50 focus:shadow-[0_0_20px_rgba(0,240,255,0.1)] transition-all"
                    autoFocus
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-neon-cyan transition-colors" size={24} />

                {query && (
                    <button
                        onClick={() => setQuery('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
                    >
                        <X size={14} className="text-white" />
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="flex gap-3 mb-8 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
                {FILTERS.map((filter) => {
                    const Icon = filter.icon;
                    const isActive = activeFilter === filter.id;
                    return (
                        <button
                            key={filter.id}
                            onClick={() => setActiveFilter(filter.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all whitespace-nowrap ${isActive
                                ? 'bg-neon-cyan/10 border-neon-cyan text-neon-cyan shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                                : 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            <Icon size={14} />
                            <span className="text-sm font-medium">{filter.label}</span>
                        </button>
                    )
                })}
            </div>

            {/* Results */}
            <div className="space-y-4">
                {loading ? (
                    Array(3).fill(0).map((_, i) => <SkeletonLoader key={i} />)
                ) : filteredMarkets.length > 0 ? (
                    <AnimatePresence>
                        {filteredMarkets.map((m) => (
                            <motion.div
                                key={m.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                            >
                                <Link href={`/?marketId=${m.id}`}>
                                    <GlassCard className="p-4 active:scale-[0.98] transition-all hover:bg-white/10">
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className="text-base font-medium text-white line-clamp-2 w-3/4">{m.question}</h4>
                                            <span className={`font-mono text-sm font-bold ${m.yesOdds >= 50 ? 'text-outcome-a' : 'text-outcome-b'}`}>
                                                {m.yesOdds.toFixed(0)}%
                                            </span>
                                        </div>

                                        {/* Mini Bar */}
                                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden flex">
                                            <div style={{ width: `${m.yesOdds}%` }} className="h-full bg-outcome-a box-shadow-[0_0_10px_rgba(74,222,128,0.5)]" />
                                            <div style={{ width: `${m.noOdds}%` }} className="h-full bg-outcome-b" />
                                        </div>

                                        <div className="flex justify-between items-center mt-3 text-xs text-text-secondary">
                                            <span>${parseFloat(m.totalVolume).toLocaleString()} Vol</span>
                                            <span className="flex items-center gap-1">
                                                Trade <TrendingUp size={10} />
                                            </span>
                                        </div>
                                    </GlassCard>
                                </Link>
                            </motion.div>
                        ))}
                    </AnimatePresence>
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

// Hide default header logic if needed or ensure layout handles it
