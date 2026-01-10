"use client";

import { useSettings } from "@/lib/settings-context";

export default function AnimatedBackground() {
    return (
        <div className="fixed inset-0 -z-50 bg-void" />
    );
}
