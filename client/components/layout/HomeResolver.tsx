"use client";

import { useState, useEffect } from "react";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { TerminalClient } from "@/components/terminal/TerminalClient";
// @ts-ignore - Import from app directory is valid but might flag TS
import { MarketsClient } from "@/app/(app)/markets/MarketsClient";
import { ServerMarket } from "@/lib/server-fetch";

interface HomeResolverProps {
    initialMarkets: ServerMarket[];
}

export default function HomeResolver({ initialMarkets }: HomeResolverProps) {
    const [isMobile, setIsMobile] = useState<boolean | null>(null);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        // Initial check
        checkMobile();

        // Listener
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // Show loader until we know the device type to avoid hydration mismatch
    if (isMobile === null) {
        return <SkeletonLoader />;
    }

    return isMobile ? (
        <MarketsClient initialMarkets={initialMarkets} />
    ) : (
        <TerminalClient initialMarkets={initialMarkets} />
    );
}
