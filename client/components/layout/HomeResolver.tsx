"use client";

import { useState, useEffect } from "react";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
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

    // Unified Home Page: Mobile & Desktop both show Markets List
    return <MarketsClient initialMarkets={initialMarkets} />;
}
