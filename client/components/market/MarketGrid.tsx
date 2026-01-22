"use client";

import { useState, useEffect } from "react";
import MarketCard from "./MarketCard";
import { motion } from "framer-motion";
import { web3MultiService as web3Service, MultiMarket } from "@/lib/web3-multi";

interface MarketGridProps {
    limit?: number;  // Optional limit for trending markets
    showFilters?: boolean;  // Whether to show category filters
    initialMarkets?: MultiMarket[];  // SSR data for instant load
}

const CATEGORIES = ['All', 'Crypto', 'Tech', 'Sports', 'Politics', 'Entertainment', 'Science'];

const EMPTY_ARRAY: MultiMarket[] = [];

export default function MarketGrid({ limit, showFilters = true, initialMarkets = EMPTY_ARRAY }: MarketGridProps) {
    // Use server-provided data if available (SSR = instant load!)
    const [markets, setMarkets] = useState<MultiMarket[]>(initialMarkets);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        // Skip fetch if we already have initial data
        if (initialMarkets.length > 0) {
            // Sort by volume
            const sorted = [...initialMarkets].sort((a, b) =>
                parseFloat(b.totalVolume) - parseFloat(a.totalVolume)
            );
            setMarkets(sorted);
            return;
        }

        async function fetchMarkets() {
            try {
                const data = await web3Service.getMarkets();
                // Sort by volume (descending) for trending
                const sorted = [...data].sort((a, b) =>
                    parseFloat(b.totalVolume) - parseFloat(a.totalVolume)
                );
                setMarkets(sorted);
            } catch (e) {
                console.error("Failed to fetch markets", e);
            }
        }
        fetchMarkets();
    }, [initialMarkets]);

    let filteredMarkets = markets.filter(m => {
        // Use API category - no fallback
        const category = m.category_id || 'General';
        const matchesCategory = selectedCategory === 'All' || category === selectedCategory;
        const matchesSearch = m.question.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    // Apply limit if specified (for trending section)
    if (limit && limit > 0) {
        filteredMarkets = filteredMarkets.slice(0, limit);
    }

    return (
        <div className={`w-full max-w-7xl mx-auto ${showFilters ? 'px-4 py-20' : ''}`}>
            {showFilters && (
                <>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        className="text-4xl font-heading font-bold mb-10 text-center"
                    >
                        <span className="text-gradient-cyan">Live</span> Predictions
                    </motion.h2>

                    {/* Search Bar */}
                    <div className="max-w-md mx-auto mb-8 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Search markets..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-full py-3 pl-10 pr-4 text-white focus:outline-none focus:border-neon-cyan/50 transition-colors"
                        />
                    </div>

                    {/* Category Filters */}
                    <div className="flex flex-wrap gap-3 justify-center mb-10">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-6 py-2 rounded-full font-mono text-sm transition-all ${selectedCategory === cat
                                    ? 'bg-primary text-black font-bold'
                                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMarkets.map((market, i) => (
                    <motion.div
                        key={market.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                    >
                        <MarketCard
                            id={market.id.toString()}
                            title={market.question}
                            volume={`$${market.totalVolume}`}
                            outcomeA={market.outcomes?.[0] || "Yes"}
                            outcomeB={market.outcomes?.[1] || "No"}
                            probA={market.prices?.[0] ? market.prices[0] / 100 : 0.5} // Convert 0-100 to 0-1
                            outcomes={market.outcomes}
                            prices={market.prices}
                            outcomeCount={market.outcomeCount}
                            color="green"
                            image_url={market.image_url || market.image}
                            description={market.description}
                        />
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
