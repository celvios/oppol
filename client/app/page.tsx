import { Suspense } from "react";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { getMarketsServer } from "@/lib/server-fetch";
import { MarketsClient } from "./(app)/markets/MarketsClient";
import { TerminalClient } from "@/components/terminal/TerminalClient";
import ClientShell from "@/components/layout/ClientShell";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

// Homepage:
// - Desktop: Show Trading Terminal
// - Mobile: Show Markets List
export default async function HomePage() {
    const markets = await getMarketsServer();
    const headersList = await headers();
    const userAgent = headersList.get("user-agent") || "";
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    return (
        <ClientShell>
            <Suspense fallback={<SkeletonLoader />}>
                {isMobile ? (
                    <MarketsClient initialMarkets={markets} />
                ) : (
                    <TerminalClient initialMarkets={markets} />
                )}
            </Suspense>
        </ClientShell>
    );
}

