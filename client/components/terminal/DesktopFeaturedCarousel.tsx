"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { MultiMarket } from "@/lib/web3-multi";
import GlassCard from "@/components/ui/GlassCard";
import { Sparkles, TrendingUp } from "lucide-react";

interface DesktopFeaturedCarouselProps {
    markets: MultiMarket[];
}

export default function DesktopFeaturedCarousel({ markets }: DesktopFeaturedCarouselProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [isPaused, setIsPaused] = useState(false);

    // Only show boosted markets
    const boostedMarkets = markets.filter(m => m.isBoosted);

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
            className="w-full mb-4"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            <div className="flex items-center gap-2 mb-2 px-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <h2 className="text-xs font-heading font-bold text-amber-400 tracking-wider">FEATURED</h2>
            </div>

            <div className="relative h-40 w-full overflow-hidden rounded-xl bg-black/20 border border-white/5">
                {boostedMarkets.map((market, index) => {
                    const isActive = index === activeIndex;

                    return (
                        <div
                            key={market.id}
                            className={`absolute inset-0 w-full h-full transition-all duration-500 ease-in-out`}
                            style={{
                                opacity: isActive ? 1 : 0,
                                zIndex: isActive ? 10 : 0,
                                transform: `translateY(${(index - activeIndex) * 10}%) scale(${isActive ? 1 : 0.95})`,
                                pointerEvents: isActive ? 'auto' : 'none',
                            }}
                        >
                            <Link href={`/trade?marketId=${market.id}`} className="block h-full w-full">
                                <div className="h-full w-full relative overflow-hidden group">
                                    {/* Background Image */}
                                    <div className="absolute inset-0">
                                        <img
                                            src={market.image_url || market.image || ''}
                                            alt=""
                                            className="w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-700"
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                                        <div className="absolute inset-0 bg-amber-500/10 mix-blend-overlay" />
                                    </div>

                                    {/* Content (Compact for Sidebar) */}
                                    <div className="absolute inset-0 p-4 flex flex-col justify-end z-10">
                                        {/* Top Badge */}
                                        <div className="absolute top-3 right-3">
                                            {market.resolved ? (
                                                <span className="px-1.5 py-0.5 bg-neon-cyan text-black text-[9px] font-bold rounded flex items-center gap-1 shadow-[0_0_8px_rgba(0,240,255,0.4)]">
                                                    RESOLVED
                                                </span>
                                            ) : (Date.now() / 1000) > (market.endTime || 0) ? (
                                                <span className="px-1.5 py-0.5 bg-orange-500 text-black text-[9px] font-bold rounded flex items-center gap-1 shadow-[0_0_8px_rgba(249,115,22,0.4)]">
                                                    ENDED
                                                </span>
                                            ) : (
                                                <span className="px-1.5 py-0.5 bg-amber-500 text-black text-[9px] font-bold rounded flex items-center gap-1 shadow-[0_0_8px_rgba(245,158,11,0.4)]">
                                                    <TrendingUp size={9} />
                                                    HOT
                                                </span>
                                            )}
                                        </div>

                                        <h3 className="text-sm font-bold text-white mb-2 leading-tight line-clamp-2 text-shadow-sm">
                                            {market.question}
                                        </h3>

                                        <div className="flex justify-between items-end border-t border-white/10 pt-2">
                                            <div className="text-[10px] text-white/50">
                                                Vol: ${market.totalVolume}
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] text-white/70 uppercase">Top Odds</span>
                                                <span className="text-amber-400 font-bold font-mono text-sm">
                                                    {Math.max(...market.prices).toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Progress Bar (Auto-scroll indicator) */}
                                    {isActive && boostedMarkets.length > 1 && !isPaused && (
                                        <div className="absolute top-0 left-0 h-0.5 bg-amber-500/30 w-full">
                                            <div
                                                className="h-full bg-amber-400 shadow-[0_0_5px_#fbbf24] animate-progress"
                                                style={{ animationDuration: '3000ms' }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </Link>
                        </div>
                    );
                })}
            </div>

            {/* Compact Pagination Dots */}
            {boostedMarkets.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-2">
                    {boostedMarkets.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setActiveIndex(idx)}
                            className={`h-1 rounded-full transition-all duration-300 ${idx === activeIndex
                                ? "w-4 bg-amber-400/80"
                                : "w-1 bg-white/10 hover:bg-white/30"
                                }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
