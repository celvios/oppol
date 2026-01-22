"use client";

import { lazy, Suspense, useEffect } from "react";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { web3MultiService } from "@/lib/web3-multi";
import type { ServerMarket } from "@/lib/server-fetch";

// Lazy load heavy terminal components
const MultiOutcomeTerminal = lazy(() => import("@/components/terminal/MultiOutcomeTerminal").then(m => ({ default: m.MultiOutcomeTerminal })));
const MobileTerminal = lazy(() => import("@/components/mobile/MobileTerminal").then(m => ({ default: m.MobileTerminal })));

interface TerminalClientProps {
    initialMarkets: ServerMarket[];
}

export function TerminalClient({ initialMarkets }: TerminalClientProps) {
    // Seed the client cache with server data on mount
    useEffect(() => {
        if (initialMarkets.length > 0) {
            web3MultiService.seedCache(initialMarkets as any);
        }
    }, [initialMarkets]);

    return (
        <>
            <div className="hidden md:block">
                <Suspense fallback={<SkeletonLoader />}>
                    <MultiOutcomeTerminal initialMarkets={initialMarkets as any} />
                </Suspense>
            </div>
            <div className="block md:hidden">
                <Suspense fallback={<SkeletonLoader />}>
                    <MobileTerminal initialMarkets={initialMarkets as any} />
                </Suspense>
            </div>
        </>
    );
}

