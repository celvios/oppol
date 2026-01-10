"use client";

import { DesktopTerminal } from "@/components/terminal/DesktopTerminal";
import { MobileTerminal } from "@/components/mobile/MobileTerminal";

import { Suspense } from "react"; // Add import
import { SkeletonLoader } from "@/components/ui/SkeletonLoader"; // Add import

export default function TerminalPage() {
    return (
        <>
            <div className="hidden md:block">
                <DesktopTerminal />
            </div>
            <div className="block md:hidden">
                <Suspense fallback={<SkeletonLoader />}>
                    <MobileTerminal />
                </Suspense>
            </div>
        </>
    );
}
