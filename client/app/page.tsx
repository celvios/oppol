import { Suspense } from "react";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { getMarketsServer } from "@/lib/server-fetch";
import { TerminalClient } from "./terminal/TerminalClient"; // Check this import path relative to page.tsx

// This is a SERVER COMPONENT - data is fetched on server, HTML arrives with data!
export default async function TerminalPage() {
    // Fetch markets on the SERVER (no loading spinner for user!)
    const markets = await getMarketsServer();

    return (
        <Suspense fallback={<SkeletonLoader />}>
            <TerminalClient initialMarkets={markets} />
        </Suspense>
    );
}
