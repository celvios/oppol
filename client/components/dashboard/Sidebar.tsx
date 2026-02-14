"use client";

import Link from "next/link";

import { usePathname, useRouter } from "next/navigation";
import { Home, PieChart, ArrowUpRight, ArrowDownRight, Shield, Wallet, LogOut, Globe, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectWallet } from "@/components/ui/ConnectWallet";
import { useBC400Check } from "@/lib/use-bc400";
import { PlusCircle } from "lucide-react";
import LogoBrand from "@/components/ui/LogoBrand";
import SidebarBoostButton from "@/components/market/SidebarBoostButton";
import BC400PurchaseModal from "@/components/modals/BC400PurchaseModal";
import { useState } from "react";
import { useWallet } from "@/lib/use-wallet";

const navItems = [
    { name: "Markets", href: "/", icon: Globe },
    { name: "Portfolio", href: "/portfolio", icon: PieChart },
    { name: "Deposit", href: "/deposit", icon: ArrowUpRight },
    { name: "Withdraw", href: "/withdraw", icon: ArrowDownRight },
    { name: "Profile", href: "/profile", icon: User },
];

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    // const router = useRouter(); // REMOVED DUPLICATE
    const { isConnected, address, disconnect, connect } = useWallet();
    const { hasNFT } = useBC400Check();



    const [showWalletModal, setShowWalletModal] = useState(false);
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);

    const handleLogout = async () => {
        try {
            await disconnect();
        } catch (error) {
            console.error('[Sidebar] Logout error:', error);
        } finally {
            if (typeof window !== 'undefined') {
                // Clear Wagmi cache/Reown cache if needed
                localStorage.removeItem('wagmi.wallet');
                localStorage.removeItem('wagmi.store');
                localStorage.removeItem('wagmi.cache');
                localStorage.removeItem('wagmi.connected');
            }
            router.push('/');
            router.refresh();
        }
    };

    const handleCreateClick = (e: React.MouseEvent) => {
        e.preventDefault();

        if (!isConnected) {
            connect();
            return;
        }

        if (hasNFT) {
            router.push('/create-market');
        } else {
            setShowPurchaseModal(true);
        }
    };

    return (
        <>
            <div
                className={cn(
                    "h-screen border-r border-white/10 bg-surface/30 backdrop-blur-md flex flex-col p-4 fixed left-0 top-0 z-50 transition-all duration-300",
                    collapsed ? "w-20" : "w-64"
                )}
            >
                {/* Header / Logo */}
                <div className="mb-6 flex items-center justify-between px-2">
                    <LogoBrand showText={!collapsed} size={collapsed ? "sm" : "md"} />
                    <div /> {/* Spacer to keep toggle button to the right if needed, or just empty */}

                    {!collapsed && (
                        <button
                            onClick={onToggle}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                        >
                            <ArrowDownRight className="rotate-[135deg]" />
                        </button>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 space-y-2">
                    {!collapsed && (
                        <div className="mb-4">
                            <SidebarBoostButton />
                        </div>
                    )}

                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 group",
                                    isActive
                                        ? "bg-primary/10 text-white border border-primary/30"
                                        : "text-white/60 hover:text-white hover:bg-white/5",
                                    collapsed ? "justify-center" : ""
                                )}
                                title={collapsed ? item.name : undefined}
                            >
                                <Icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", isActive && "text-primary")} />
                                {!collapsed && <span className="font-medium text-sm">{item.name}</span>}
                                {isActive && !collapsed && (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                                )}
                            </Link>
                        );
                    })}

                    <div
                        onClick={() => alert("Leaderboard Coming Soon!")}
                        className={cn(
                            "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 group cursor-pointer text-white/60 hover:text-white hover:bg-white/5",
                            collapsed ? "justify-center" : ""
                        )}
                        title={collapsed ? "Leaderboard" : undefined}
                    >
                        <Trophy className="w-5 h-5 transition-transform group-hover:scale-110" />
                        {!collapsed && <span className="font-medium text-sm">Leaderboard</span>}
                    </div>

                    <div
                        onClick={handleCreateClick}
                        className={cn(
                            "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 group mt-2 bg-neon-cyan/5 hover:bg-neon-cyan/10 cursor-pointer",
                            pathname === "/create-market"
                                ? "text-neon-cyan"
                                : "text-neon-cyan/80",
                            collapsed ? "justify-center" : ""
                        )}
                        title={collapsed ? "Create Poll" : undefined}
                    >
                        <PlusCircle className="w-5 h-5 text-neon-cyan" />
                        {!collapsed && <span className="font-medium text-sm text-neon-cyan">Create Poll</span>}
                    </div>



                    {!collapsed && (
                        <div className="mt-4 mb-2">
                            {/* <SidebarBoostButton /> */}
                        </div>
                    )}

                    <div className={cn("mt-auto", collapsed ? "flex justify-center" : "")}>
                        <ConnectWallet />
                    </div>


                </nav>

                {!collapsed && (
                    <div className="pt-4 border-t border-white/10 text-center">
                        <span className="text-[10px] text-white/20">Powered by BNB Chain</span>
                    </div>
                )}
            </div>

            <BC400PurchaseModal
                isOpen={showPurchaseModal}
                onClose={() => setShowPurchaseModal(false)}
            />
        </>
    );
}

