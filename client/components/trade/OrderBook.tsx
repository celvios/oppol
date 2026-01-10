"use client";

import GlassCard from "@/components/ui/GlassCard";

const bids = [
    { price: 0.64, size: 5000 },
    { price: 0.63, size: 2500 },
    { price: 0.62, size: 12000 },
    { price: 0.61, size: 8000 },
];

const asks = [
    { price: 0.66, size: 3000 },
    { price: 0.67, size: 4500 },
    { price: 0.68, size: 1500 },
    { price: 0.69, size: 6000 },
];

export default function OrderBook() {
    return (
        <GlassCard className="h-full p-6 flex flex-col">
            <h3 className="text-lg font-heading font-bold mb-4 border-b border-white/10 pb-2">Order Book</h3>

            <div className="flex-1 space-y-4 font-mono text-sm">

                {/* Asks (Sellers) - Red */}
                <div className="space-y-1">
                    {asks.reverse().map((ask, i) => (
                        <div key={i} className="flex justify-between text-outcome-b/80 hover:bg-outcome-b/5 px-2 py-0.5 rounded transition-colors cursor-pointer">
                            <span>{ask.price.toFixed(2)}</span>
                            <span>{ask.size.toLocaleString()}</span>
                        </div>
                    ))}
                </div>

                {/* Spread */}
                <div className="flex justify-between items-center py-2 border-y border-white/5 text-xs text-text-secondary">
                    <span>Spread</span>
                    <span>0.02 (3.1%)</span>
                </div>

                {/* Bids (Buyers) - Green */}
                <div className="space-y-1">
                    {bids.map((bid, i) => (
                        <div key={i} className="flex justify-between text-outcome-a/80 hover:bg-outcome-a/5 px-2 py-0.5 rounded transition-colors cursor-pointer">
                            <span>{bid.price.toFixed(2)}</span>
                            <span>{bid.size.toLocaleString()}</span>
                        </div>
                    ))}
                </div>

            </div>
        </GlassCard>
    );
}
