"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, BarChart2, Search, Wallet, User, LayoutGrid } from "lucide-react";
import { motion } from "framer-motion";
import { twMerge } from "tailwind-merge";
import { useState } from "react";
import { useUIStore } from "@/lib/store";
import { useWallet } from "@/lib/use-wallet";
import { useCreationAccess } from "@/lib/use-creation-access";
import { PlusCircle } from "lucide-react";

export default function BottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { isTradeModalOpen, isInputFocused, isCommentsOpen } = useUIStore();
    const { isConnected, address, disconnect, connect } = useWallet();
    const { canCreate } = useCreationAccess();
    const [showWalletModal, setShowWalletModal] = useState(false);

    const handleLogout = () => {
        localStorage.clear();
        disconnect();
        router.push('/');
    };

    const isLoggedIn = isConnected;

    if (isTradeModalOpen || isInputFocused || isCommentsOpen) return null;

    const navItems = [
        { name: "Terminal", icon: Home, href: "/terminal" },
        { name: "Markets", icon: LayoutGrid, href: "/markets" },
        ...(canCreate ? [{ name: "Create", icon: PlusCircle, href: "/admin/create-market" }] : []),
        { name: "Search", icon: Search, href: "/search" },
        { name: "Portfolio", icon: Wallet, href: "/terminal/portfolio" },
    ];

    return (
        <>
            <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden" suppressHydrationWarning={true}>
                <div className="absolute inset-0 bg-void/80 backdrop-blur-xl border-t border-white/5" suppressHydrationWarning={true} />

                <nav className="relative flex justify-around items-center h-20 pb-2" suppressHydrationWarning={true}>
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className="flex flex-col items-center justify-center w-full h-full text-xs font-medium gap-1 relative"
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="nav-active"
                                        className="absolute -top-[1px] w-12 h-1 bg-neon-cyan rounded-full shadow-[0_0_10px_#00F0FF]"
                                    />
                                )}

                                <Icon
                                    className={twMerge(
                                        "w-6 h-6 transition-colors duration-300",
                                        isActive ? "text-neon-cyan" : "text-text-secondary"
                                    )}
                                />
                                <span className={twMerge(
                                    "transition-colors duration-300",
                                    isActive ? "text-white" : "text-text-secondary"
                                )}>
                                    {item.name}
                                </span>
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </>
    );
}
