"use client";

import { lazy, Suspense } from "react";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";

// Lazy load heavy terminal components
const MultiOutcomeTerminal = lazy(() => import("@/components/terminal/MultiOutcomeTerminal").then(m => ({ default: m.MultiOutcomeTerminal })));
const MobileTerminal = lazy(() => import("@/components/mobile/MobileTerminal").then(m => ({ default: m.MobileTerminalWithDebug })));

export default function TerminalPage() {
    return (
        <>
            <div className="hidden md:block">
                <Suspense fallback={<SkeletonLoader />}>
                    <MultiOutcomeTerminal />
                </Suspense>
            </div>
            <div className="block md:hidden">
                <Suspense fallback={<SkeletonLoader />}>
                    <MobileTerminal />
                </Suspense>
            </div>
        </>
    );
}
