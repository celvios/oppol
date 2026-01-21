"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoBrand from "@/components/ui/LogoBrand";

export default function Header() {
    const pathname = usePathname();

    // Hide header on terminal/admin pages (they have sidebar)
    if (pathname?.startsWith('/terminal') || pathname?.startsWith('/admin')) {
        return null;
    }

    return (
        <header className="relative top-0 left-0 right-0 z-50 w-full">
            {/* Subtle backdrop blur to blend with landing page */}
            <div className="absolute inset-0 bg-void/60 backdrop-blur-sm border-b border-white/5" />
            <div className="relative w-full px-4 md:px-6 py-3 md:py-4 flex items-center justify-start">
                {/* Logo - Top Left Position */}
                <div className="hidden md:block">
                    <LogoBrand size="xl" href="/" />
                </div>
                <div className="md:hidden">
                    <LogoBrand size="md" href="/" />
                </div>
            </div>
        </header>
    );
}
