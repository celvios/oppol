
import { Suspense } from "react";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { getMarketsServer } from "@/lib/server-fetch";
import { TerminalClient } from "@/components/terminal/TerminalClient";

// This is a SERVER COMPONENT
export const dynamic = 'force-dynamic';

// Add loading component for immediate feedback
function TradePageLoading() {
    return (
        <div className="min-h-screen bg-void flex items-center justify-center">
            <div className="text-center space-y-4">
                <div className="w-16 h-16 border-4 border-neon-green/30 border-t-neon-green rounded-full animate-spin mx-auto"></div>
                <p className="text-white/60 text-sm font-mono">Loading market...</p>
            </div>
        </div>
    );
}

export default async function TradePage() {
    const markets = await getMarketsServer();

    return (
        <Suspense fallback={<TradePageLoading />}>
            <TerminalClient initialMarkets={markets} />
        </Suspense>
    );
}
