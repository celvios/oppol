"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Terminal } from "lucide-react";
import NeonButton from "./NeonButton";

export default function Header() {
    const pathname = usePathname();
    
    // Hide header on terminal/admin pages (they have sidebar)
    if (pathname?.startsWith('/terminal') || pathname?.startsWith('/admin')) {
        return null;
    }

    return (
        <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center group">
                    <Image
                        src="/Opollll.jpg"
                        alt="OPoll"
                        width={160}
                        height={48}
                        className="h-12 w-auto object-contain"
                        priority
                    />
                </Link>

                {/* CTA Button */}
                <Link href="/terminal">
                    <NeonButton variant="cyan" className="px-4 py-2 text-sm">
                        <Terminal className="w-4 h-4 mr-2" />
                        Launch App
                    </NeonButton>
                </Link>
            </div>
        </header>
    );
}

