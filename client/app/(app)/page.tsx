import { Suspense } from "react";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { getMarketsServer } from "@/lib/server-fetch";
import HomeResolver from "@/components/layout/HomeResolver";

// Homepage:
// - Desktop: Show Trading Terminal
// - Mobile: Show Markets List
// Logic handled reliably on client side by HomeResolver
export const dynamic = 'force-dynamic';
export const revalidate = 0; // Disable caching

export default async function HomePage() {
    const markets = await getMarketsServer();

    return (
        <Suspense fallback={<SkeletonLoader />}>
            <HomeResolver initialMarkets={markets} />
        </Suspense>
    );
}

