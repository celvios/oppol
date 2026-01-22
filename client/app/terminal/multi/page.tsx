"use client";

import { Suspense } from "react";
import { MultiOutcomeTerminal } from "@/components/terminal/MultiOutcomeTerminal";

export default function MultiOutcomeMarketsPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-void" />}>
            <MultiOutcomeTerminal />
        </Suspense>
    );
}
