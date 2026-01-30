"use client";

import { useEffect } from "react";
import MarketGrid from "@/components/market/MarketGrid";
import AnimatedBackground from "@/components/ui/AnimatedBackground";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import MobileMarketList from "@/components/mobile/MobileMarketList";
import { web3MultiService } from "@/lib/web3-multi";
import type { ServerMarket } from "@/lib/server-fetch";
import DesktopFeaturedCarousel from "@/components/terminal/DesktopFeaturedCarousel";

interface MarketsClientProps {
    initialMarkets: ServerMarket[];
}

export function MarketsClient({ initialMarkets }: MarketsClientProps) {
    // Seed the client cache with server data
    useEffect(() => {
        if (initialMarkets.length > 0) {
            web3MultiService.seedCache(initialMarkets as any);
        }
    }, [initialMarkets]);

    return (
        <div className="min-h-screen relative bg-void text-white">
            <AnimatedBackground />

            <div className="relative z-10 p-6">




                <div className="md:hidden">
                    <MobileMarketList initialMarkets={initialMarkets as any} />
                </div>
                <div className="hidden md:block space-y-12">
                    {/* 1. Featured Markets Carousel */}
                    <section>
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                            <span className="text-yellow-400">🔥</span> Featured Markets
                        </h2>
                        <DesktopFeaturedCarousel markets={initialMarkets as any} />
                    </section>

                    {/* 2. Trending Markets (Limit 3) */}
                    <section>
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                            <span className="text-neon-cyan">📈</span> Trending Markets
                        </h2>
                        {/* MarketGrid Limit=3, No Filters */}
                        <MarketGrid initialMarkets={initialMarkets as any} limit={3} showFilters={false} />
                    </section>

                    {/* 3. All Markets (With Filters) */}
                    <div className="pt-8 border-t border-white/10">
                        <MarketGrid initialMarkets={initialMarkets as any} />
                    </div>
                </div>
            </div>
        </div>
    );
}

