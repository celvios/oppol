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
        <header className="px-6 py-4">
            <div className="max-w-7xl mx-auto flex items-center">
                {/* Logo */}
                <Link href="/" className="flex items-center group">
                    <LogoBrand size="sm" animate={false} />
                </Link>
            </div>
        </header>
    );
}

