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

const EMPTY_ARRAY: MultiMarket[] = [];

export default function MarketGrid({ limit, showFilters = true, initialMarkets = EMPTY_ARRAY }: MarketGridProps) {
    // Use server-provided data if available (SSR = instant load!)
    const [markets, setMarkets] = useState<MultiMarket[]>(initialMarkets);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [categories, setCategories] = useState<string[]>(['All']);

    // Fetch categories from API
    useEffect(() => {
        async function fetchCategories() {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL;
                if (apiUrl) {
                    const response = await fetch(`${apiUrl}/api/categories`);
                    const data = await response.json();
                    if (data.success && data.categories) {
                        const categoryNames = data.categories.map((cat: any) => cat.name);
                        // Add special categories: Trending & New
                        setCategories(['All', 'Trending', 'New', ...categoryNames]);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch categories:", error);
                setCategories(['All', 'Trending', 'New']);
            }
        }
        fetchCategories();
    }, []);

    useEffect(() => {
        // 1. Initial hydration
        if (initialMarkets.length > 0) {
            setMarkets([...initialMarkets]);
        }

        // 2. Fetch fresh data in background
        async function fetchMarkets() {
            try {
                const data = await web3Service.getMarkets();
                setMarkets(data);
            } catch (e) {
                console.error("Failed to fetch markets", e);
            }
        }

        const timer = setTimeout(fetchMarkets, 100);

        // 3. Subscribe to updates
        const unsubscribe = web3Service.onMarketsUpdate((updatedMarkets) => {
            setMarkets(updatedMarkets);
        });

        return () => {
            clearTimeout(timer);
            unsubscribe();
        };
    }, [initialMarkets]);

    let filteredMarkets = markets.filter(m => {
        // Special Category Logic
        if (selectedCategory === 'Trending') return true; // Will sort by volume later
        if (selectedCategory === 'New') {
            // "New" = Created within the last 48 hours
            if (m.created_at) {
                const createdAtTime = new Date(m.created_at).getTime();
                const now = Date.now();
                const MS_IN_48_HOURS = 48 * 60 * 60 * 1000;
                return (now - createdAtTime) <= MS_IN_48_HOURS;
            }
            // Fallback if no timestamp: assume top 12 IDs are new (handled in sort below)
            return true;
        }

        // Standard Category Logic
        const matchesSearch = (m.question || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (m.description || "").toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === "All" || (m.category_id || "General") === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    // Apply Sorting based on Category
    if (selectedCategory === 'Trending') {
        filteredMarkets.sort((a, b) => parseFloat(b.totalVolume) - parseFloat(a.totalVolume));
    } else if (selectedCategory === 'New') {
        // Sort by Created At descending (Newest first)
        filteredMarkets.sort((a, b) => {
            if (a.created_at && b.created_at) {
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
            return Number(b.id) - Number(a.id); // Fallback to ID
        });

        // If we filtered by 48h timestamp, we don't strictly need to slice, 
        // but let's keep it reasonable or remove slice if "New" means ALL within 48h.
        // User requested: "new markets that are created within 48 hrs show up"
        // So no slice limit if they are within 48h.
        // However, if we fell back to IDs (no timestamp), we should slice.
        const hasTimestamps = filteredMarkets.some(m => m.created_at);
        if (!hasTimestamps) {
            filteredMarkets = filteredMarkets.slice(0, 12);
        }
    } else {
        // Default sort mechanisms (maybe by volume or ending soon?)
        // Let's keep existing order or volume default
        filteredMarkets.sort((a, b) => parseFloat(b.totalVolume) - parseFloat(a.totalVolume));
    }

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
                    <div className="max-w-2xl mx-auto mb-10 relative">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-neon-cyan/50 group-focus-within:text-neon-cyan transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                placeholder="Search markets..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-black/40 backdrop-blur-xl border border-white/10 hover:border-white/20 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-neon-cyan/50 focus:shadow-[0_0_30px_rgba(0,240,255,0.1)] transition-all font-mono text-lg placeholder:text-white/20"
                            />
                        </div>
                    </div>

                    {/* Category Filters */}
                    <div className="flex flex-wrap gap-3 justify-center mb-10">
                        {categories.map((cat: string) => (
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
                            isBoosted={market.isBoosted}
                            endTime={market.endTime}
                            resolved={market.resolved}
                            winningOutcome={market.winningOutcome}
                        />
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
