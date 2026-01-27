import { Suspense } from "react";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { getMarketsServer } from "@/lib/server-fetch";
import { TerminalClient } from "@/components/terminal/TerminalClient";
import { Sidebar } from "@/components/dashboard/Sidebar";
import ClientShell from "@/components/layout/ClientShell"; // We'll create this to handle client-side state like 'collapsed'

// This is a SERVER COMPONENT - data is fetched on server, HTML arrives with data!
export default async function TerminalPage() {
    // Fetch markets on the SERVER (no loading spinner for user!)
    const markets = await getMarketsServer();

    return (
        <ClientShell>
            <Suspense fallback={<SkeletonLoader />}>
                <TerminalClient initialMarkets={markets} />
            </Suspense>
        </ClientShell>
    );
}
