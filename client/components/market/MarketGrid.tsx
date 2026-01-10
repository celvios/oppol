"use client";

import MarketCard from "./MarketCard";
import { motion } from "framer-motion";

const MARKETS = [
    { id: "btc-100k", title: "Will Bitcoin hit $100k before 2026?", volume: "$12.5M", outcomeA: "Yes", outcomeB: "No", probA: 0.65, color: "cyan" as const },
    { id: "gta-6", title: "GTA VI Release date confirmed for 2025?", volume: "$3.2M", outcomeA: "Yes", outcomeB: "No", probA: 0.85, color: "coral" as const },
    { id: "fed-rate", title: "Fed Interest Rate Cut in March?", volume: "$45M", outcomeA: "Cut", outcomeB: "Hold", probA: 0.30, color: "green" as const },
    { id: "election-us", title: "US Election: Party Winner?", volume: "$102M", outcomeA: "Dem", outcomeB: "Rep", probA: 0.48, color: "cyan" as const },
    { id: "spacex-mars", title: "SpaceX Starship reaches orbit?", volume: "$8.1M", outcomeA: "Success", outcomeB: "Fail", probA: 0.92, color: "coral" as const },
    { id: "ai-agi", title: "AGI achieved by Q4 2025?", volume: "$15M", outcomeA: "Yes", outcomeB: "No", probA: 0.15, color: "green" as const },
];

export default function MarketGrid() {
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
                {MARKETS.map((market, i) => (
                    <motion.div
                        key={market.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                    >
                        <MarketCard {...market} />
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
