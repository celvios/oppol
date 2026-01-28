
import { Suspense } from "react";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { getMarketsServer } from "@/lib/server-fetch";
import { TerminalClient } from "@/components/terminal/TerminalClient";
import ClientShell from "@/components/layout/ClientShell";

// This is a SERVER COMPONENT
export default async function TradePage() {
    const markets = await getMarketsServer();

    return (
        <ClientShell>
            <Suspense fallback={<SkeletonLoader />}>
                <TerminalClient initialMarkets={markets} />
            </Suspense>
        </ClientShell>
    );
}
