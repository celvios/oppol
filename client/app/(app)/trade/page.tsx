
import { Suspense } from "react";
import { TerminalSkeleton } from "@/components/ui/SkeletonLoader";
import { getMarketsServer } from "@/lib/server-fetch";
import { TerminalClient } from "@/components/terminal/TerminalClient";

// This is a SERVER COMPONENT
export const dynamic = 'force-dynamic';

export default async function TradePage() {
    const markets = await getMarketsServer();

    return (
        <Suspense fallback={<TerminalSkeleton />}>
            <TerminalClient initialMarkets={markets} />
        </Suspense>
    );
}
