"use client";

import { useEffect } from "react";
import MarketGrid from "@/components/market/MarketGrid";
import AnimatedBackground from "@/components/ui/AnimatedBackground";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import MobileMarketList from "@/components/mobile/MobileMarketList";
import { web3MultiService } from "@/lib/web3-multi";
import type { ServerMarket } from "@/lib/server-fetch";

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
                <Link href="/terminal" className="inline-flex items-center text-text-secondary hover:text-white transition-colors mb-8">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Terminal
                </Link>

                <h1 className="text-5xl font-heading font-bold text-center mb-4">Market <span className="text-gradient-cyan">Discovery</span></h1>
                <p className="text-center text-text-secondary max-w-2xl mx-auto mb-12">Search, filter, and trade on hundreds of real-time prediction markets.</p>

                <div className="md:hidden">
                    <MobileMarketList initialMarkets={initialMarkets as any} />
                </div>
                <div className="hidden md:block">
                    <MarketGrid initialMarkets={initialMarkets as any} />
                </div>
            </div>
        </div>
    );
}

