"use client";

import { useState, useEffect } from "react";
import MarketCard from "./MarketCard";
import { motion } from "framer-motion";
import { web3Service } from "@/lib/web3";

interface Market {
    id: number;
    question: string;
    yesOdds: number;
    noOdds: number;
    totalVolume: string;
    resolved: boolean;
    outcome: boolean;
}

export default function MarketGrid() {
    const [markets, setMarkets] = useState<Market[]>([]);

    useEffect(() => {
        async function fetchMarkets() {
            try {
                const data = await web3Service.getMarkets();
                setMarkets(data);
            } catch (e) {
                console.error("Failed to fetch markets", e);
            }
        }
        fetchMarkets();
    }, []);

    return (
        <div className="w-full max-w-7xl mx-auto px-4 py-20">
            <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                className="text-4xl font-heading font-bold mb-10 text-center"
            >
                <span className="text-gradient-cyan">Live</span> Predictions
            </motion.h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {markets.map((market, i) => (
                    <motion.div
                        key={market.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                    >
                        {/* Adapter for MarketCard to accept the new data structure */}
                        <MarketCard
                            id={market.id.toString()}
                            title={market.question}
                            volume={`$${market.totalVolume}`}
                            outcomeA="Yes"
                            outcomeB="No"
                            probA={market.yesOdds / 100}
                            color="green" // Default or calculate based on trend
                        />
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
