"use client";

import { useState, useEffect } from "react";
import MarketCard from "./MarketCard";
import { motion } from "framer-motion";
import { web3Service } from "@/lib/web3";
import Link from "next/link";
import { getMarketMetadata, getMultiMarketMetadata } from "@/lib/market-metadata";

interface Market {
    id: number;
    question: string;
    yesOdds: number;
    noOdds: number;
    totalVolume: string;
    resolved: boolean;
    outcome: boolean;
    outcomes?: string[];
    prices?: number[];
}

interface MarketGridProps {
    limit?: number;  // Optional limit for trending markets
    showFilters?: boolean;  // Whether to show category filters
}

const CATEGORIES = ['All', 'Crypto', 'Tech', 'Sports', 'Politics', 'Entertainment', 'Science'];

export default function MarketGrid({ limit, showFilters = true }: MarketGridProps) {
    const [markets, setMarkets] = useState<Market[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('All');

    useEffect(() => {
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
    }, []);

    let filteredMarkets = selectedCategory === 'All'
        ? markets
        : markets.filter(m => {
            const metadata = getMultiMarketMetadata(m.question, m.id) || getMarketMetadata(m.question, m.id);
            return metadata.category === selectedCategory;
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
                        <Link href={`/terminal?marketId=${market.id}`}>
                            <MarketCard
                                id={market.id.toString()}
                                title={market.question}
                                volume={`$${market.totalVolume}`}
                                outcomeA="Yes"
                                outcomeB="No"
                                probA={market.yesOdds / 100}
                                color="green"
                            />
                        </Link>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
