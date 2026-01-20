"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function Header() {
    const pathname = usePathname();
    
    // Hide header on terminal/admin pages (they have sidebar)
    if (pathname?.startsWith('/terminal') || pathname?.startsWith('/admin')) {
        return null;
    }

    return (
        <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
            <div className="max-w-7xl mx-auto flex items-center">
                {/* Logo */}
                <Link href="/" className="flex items-center group">
                    <Image
                        src="/Opollll.jpg"
                        alt="OPoll"
                        width={200}
                        height={60}
                        className="h-16 w-auto object-contain"
                        priority
                    />
                </Link>
            </div>
        </header>
    );
}

