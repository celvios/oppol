"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PieChart, ArrowUpRight, ArrowDownRight, Settings, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { WalletConnectButton } from "@/components/ui/WalletConnectButton";
import { useWallet } from "@/lib/use-wallet";

const navItems = [
    { name: "Terminal", href: "/terminal", icon: Home },
    { name: "Portfolio", href: "/terminal/portfolio", icon: PieChart },
    { name: "Deposit", href: "/terminal/deposit", icon: ArrowUpRight },
    { name: "Withdraw", href: "/terminal/withdraw", icon: ArrowDownRight },
    { name: "Settings", href: "/terminal/settings", icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();
    const { isAdmin, isConnected } = useWallet();

    return (
        <div className="w-64 h-screen border-r border-white/10 bg-surface/30 backdrop-blur-md flex flex-col p-4 fixed left-0 top-0 z-50">
            <div className="mb-6 flex items-center gap-3 px-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/50">
                    <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_#00E0FF]" />
                </div>
                <span className="font-mono font-bold text-lg tracking-wider text-white">OPOLL</span>
            </div>

            {/* Wallet Connect Section */}
            <div className="mb-6 px-2">
                <WalletConnectButton />
            </div>

            <nav className="flex-1 space-y-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group",
                                isActive
                                    ? "bg-primary/10 text-primary border border-primary/20"
                                    : "text-white/60 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <Icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", isActive && "text-primary")} />
                            <span className="font-medium text-sm">{item.name}</span>
                            {isActive && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_#00E0FF]" />
                            )}
                        </Link>
                    );
                })}

                {/* Admin Link - Only visible if user has 50M+ tokens */}
                {isConnected && isAdmin && (
                    <Link
                        href="/admin"
                        className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group mt-4 border",
                            pathname === "/admin"
                                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                : "text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/10 border-transparent hover:border-amber-500/20"
                        )}
                    >
                        <Shield className="w-5 h-5" />
                        <span className="font-medium text-sm">Admin Panel</span>
                        {pathname === "/admin" && (
                            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#F59E0B]" />
                        )}
                    </Link>
                )}
            </nav>

            <div className="pt-4 border-t border-white/10 text-center">
                <span className="text-xs text-white/30">Powered by BNB Chain</span>
            </div>
        </div>
    );
}
