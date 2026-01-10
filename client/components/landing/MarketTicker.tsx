"use client";

import { motion } from "framer-motion";

const markets = [
    { id: 1, pair: "BTC/USDT", price: "48,500", change: "+2.4%", hot: true },
    { id: 2, pair: "ETH/USDT", price: "2,800", change: "+1.8%", hot: false },
    { id: 3, pair: "SOL/USDT", price: "108", change: "-0.5%", hot: false },
    { id: 4, pair: "Trump 2024", price: "Yes 0.65", change: "+5%", hot: true },
    { id: 5, pair: "Fed Rate Cut", price: "No 0.82", change: "+0.1%", hot: false },
    { id: 6, pair: "SpaceX Launch", price: "Success 0.90", change: "+0.0%", hot: false },
    { id: 7, pair: "GTA VI Release", price: "2025 0.70", change: "+12%", hot: true },
];

export default function MarketTicker() {
    return (
        <div className="w-full overflow-hidden absolute top-24 z-10 opacity-80 pointer-events-none">
            {/* Gradient Masks for fading edges */}
            <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-void to-transparent z-20" />
            <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-void to-transparent z-20" />

            <div className="flex">
                <motion.div
                    className="flex gap-8 px-4"
                    animate={{ x: ["0%", "-50%"] }}
                    transition={{
                        ease: "linear",
                        duration: 30,
                        repeat: Infinity,
                    }}
                >
                    {[...markets, ...markets, ...markets].map((market, i) => ( // Triple duplication for smooth loop
                        <div
                            key={i}
                            className={`
                                flex items-center gap-3 px-4 py-2 rounded-full border 
                                ${market.hot ? "border-outcome-a/30 bg-outcome-a/5" : "border-white/10 bg-white/5"}
                                backdrop-blur-sm whitespace-nowrap
                            `}
                        >
                            <span className="text-sm font-mono font-medium text-gray-300">{market.pair}</span>
                            <span className={`text-sm font-bold ${market.change.startsWith("+") ? "text-success" : "text-outcome-b"}`}>
                                {market.price}
                            </span>
                            <span className="text-xs text-gray-500">{market.change}</span>
                        </div>
                    ))}
                </motion.div>
            </div>
        </div>
    );
}
