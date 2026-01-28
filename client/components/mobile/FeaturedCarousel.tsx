"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { MultiMarket } from "@/lib/web3-multi";
import GlassCard from "@/components/ui/GlassCard";
import { Sparkles, TrendingUp } from "lucide-react";

interface FeaturedCarouselProps {
    markets: MultiMarket[];
}

export default function FeaturedCarousel({ markets }: FeaturedCarouselProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [isPaused, setIsPaused] = useState(false);

    // Only show boosted markets
    const boostedMarkets = markets.filter(m => m.isBoosted);
    console.log('[FeaturedCarousel] Markets:', markets.length, 'Boosted:', boostedMarkets.length);

    // Reset when markets change
    useEffect(() => {
        setActiveIndex(0);
    }, [boostedMarkets.length]);

    // Auto-scroll logic (3 seconds)
    useEffect(() => {
        if (boostedMarkets.length <= 1 || isPaused) return;

        const nextSlide = () => {
            setActiveIndex((current) => (current + 1) % boostedMarkets.length);
        };

        timeoutRef.current = setInterval(nextSlide, 3000);

        return () => {
            if (timeoutRef.current) clearInterval(timeoutRef.current);
        };
    }, [activeIndex, boostedMarkets.length, isPaused]);

    if (boostedMarkets.length === 0) return null;

    return (
        <div
            className="w-full mb-6 px-4"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
        >
            <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-heading font-bold text-amber-400 tracking-wider">FEATURED</h2>
            </div>

            <div className="relative h-48 w-full overflow-hidden rounded-2xl">
                {boostedMarkets.map((market, index) => {
                    // Calculate position relative to active index
                    let position = 100; // Default off-screen right
                    if (index === activeIndex) position = 0; // Active
                    else if (index === (activeIndex - 1 + boostedMarkets.length) % boostedMarkets.length) position = -100; // Previous (off-screen left)

                    // Specific logic for smooth circular transition
                    // Not using complex math, just opacity/translate for now for simplicity & performance
                    const isActive = index === activeIndex;

                    return (
                        <div
                            key={market.id}
                            className={`absolute inset-0 w-full h-full transition-all duration-500 ease-in-out transform`}
                            style={{
                                opacity: isActive ? 1 : 0,
                                zIndex: isActive ? 10 : 0,
                                transform: `translateX(${(index - activeIndex) * 10}% scale(${isActive ? 1 : 0.9}))`,
                                pointerEvents: isActive ? 'auto' : 'none',
                                // Note: Simple fade/scale is safer than sliding for verifying perfect centering first
                            }}
                        >
                            <Link href={`/?marketId=${market.id}`} className="block h-full w-full">
                                <GlassCard className="h-full w-full relative overflow-hidden group border border-amber-500/30">
                                    {/* Background Image */}
                                    <div className="absolute inset-0">
                                        <img
                                            src={market.image_url || market.image || ''}
                                            alt=""
                                            className="w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-700"
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                                        <div className="absolute inset-0 bg-amber-500/5 mix-blend-overlay" />
                                    </div>

                                    {/* Content */}
                                    <div className="absolute inset-0 p-5 flex flex-col justify-end z-10">

                                        {/* Top Badge */}
                                        <div className="absolute top-4 right-4">
                                            <span className="px-2 py-1 bg-amber-500 text-black text-[10px] font-bold rounded flex items-center gap-1 shadow-[0_0_10px_rgba(245,158,11,0.4)]">
                                                <TrendingUp size={10} />
                                                HOT
                                            </span>
                                        </div>

                                        <h3 className="text-lg font-bold text-white mb-2 leading-tight line-clamp-2 text-shadow-sm">
                                            {market.question}
                                        </h3>

                                        <div className="flex justify-between items-end">
                                            <div className="flex gap-3 text-xs font-mono text-white/70">
                                                <span className="bg-black/30 px-2 py-1 rounded backdrop-blur-sm border border-white/5">
                                                    Vol: ${market.totalVolume}
                                                </span>
                                            </div>

                                            {/* Odds Preview (Top Outcome) */}
                                            <div className="text-right">
                                                <div className="text-amber-400 font-bold text-xl font-mono text-shadow-glow">
                                                    {Math.max(...market.prices).toFixed(0)}%
                                                </div>
                                                <div className="text-[10px] text-white/50 uppercase tracking-widest">
                                                    Chance
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Progress Bar (Auto-scroll indicator) */}
                                    {isActive && boostedMarkets.length > 1 && !isPaused && (
                                        <div className="absolute bottom-0 left-0 h-1 bg-amber-500/50 w-full">
                                            <div
                                                className="h-full bg-amber-400 shadow-[0_0_10px_#fbbf24] animate-progress"
                                                style={{ animationDuration: '3000ms' }}
                                            />
                                        </div>
                                    )}
                                </GlassCard>
                            </Link>
                        </div>
                    );
                })}
            </div>

            {/* Pagination Dots */}
            {boostedMarkets.length > 1 && (
                <div className="flex justify-center gap-2 mt-3">
                    {boostedMarkets.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setActiveIndex(idx)}
                            className={`h-1.5 rounded-full transition-all duration-300 ${idx === activeIndex
                                ? "w-6 bg-amber-400 shadow-[0_0_5px_#fbbf24]"
                                : "w-1.5 bg-white/20 hover:bg-white/40"
                                }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
