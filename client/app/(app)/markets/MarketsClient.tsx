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

