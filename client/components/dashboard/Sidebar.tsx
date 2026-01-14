"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, PieChart, ArrowUpRight, ArrowDownRight, Shield, Wallet, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWallet } from "@/lib/use-wallet";

const navItems = [
    { name: "Terminal", href: "/terminal", icon: Home },
    { name: "Portfolio", href: "/terminal/portfolio", icon: PieChart },
    { name: "Deposit", href: "/terminal/deposit", icon: ArrowUpRight },
    { name: "Withdraw", href: "/terminal/withdraw", icon: ArrowDownRight },
];

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { isAdmin, isConnected, address, disconnect, connect } = useWallet();

    const handleLogout = () => {
        disconnect();
        router.push('/');
    };

    return (
        <>
            <div
                className={cn(
                    "h-screen border-r border-white/10 bg-surface/30 backdrop-blur-md flex flex-col p-4 fixed left-0 top-0 z-50 transition-all duration-300",
                    collapsed ? "w-20" : "w-64"
                )}
            >
                {/* Header / Toggle */}
                <div className="mb-6 flex items-center justify-between px-2">
                    {!collapsed && (
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/50">
                                <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_#00E0FF]" />
                            </div>
                            <span className="font-mono font-bold text-lg tracking-wider text-white">OPoll</span>
                        </div>
                    )}
                    <button
                        onClick={onToggle}
                        className={cn(
                            "p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors",
                            collapsed ? "mx-auto" : ""
                        )}
                    >
                        {collapsed ? <ArrowUpRight className="rotate-45" /> : <ArrowDownRight className="rotate-[135deg]" />}
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 space-y-2">
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
                                        ? "bg-primary/10 text-primary border border-primary/20"
                                        : "text-white/60 hover:text-white hover:bg-white/5",
                                    collapsed ? "justify-center" : ""
                                )}
                                title={collapsed ? item.name : undefined}
                            >
                                <Icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", isActive && "text-primary")} />
                                {!collapsed && <span className="font-medium text-sm">{item.name}</span>}
                                {isActive && !collapsed && (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_#00E0FF]" />
                                )}
                            </Link>
                        );
                    })}

                    {isConnected ? (
                        <div
                            className={cn(
                                "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 group bg-primary/10 text-primary border border-primary/20",
                                collapsed ? "justify-center" : ""
                            )}
                        >
                            <div className="relative">
                                <Wallet className="w-5 h-5" />
                                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_#00E0FF]" />
                            </div>
                            {!collapsed && (
                                <>
                                    <div className="flex-1">
                                        <span className="font-mono text-xs">
                                            {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Logged In'}
                                        </span>
                                    </div>
                                    <button
                                        onClick={handleLogout}
                                        className="p-1 hover:bg-red-500/20 rounded-lg transition-colors group"
                                        title="Logout"
                                    >
                                        <LogOut size={14} className="text-white/40 group-hover:text-red-400" />
                                    </button>
                                </>
                            )}
                            {collapsed && (
                                <button
                                    onClick={handleLogout}
                                    className="absolute inset-0"
                                    title="Logout"
                                />
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={() => connect()}
                            className={cn(
                                "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 group w-full",
                                "text-white/60 hover:text-white hover:bg-white/5",
                                collapsed ? "justify-center" : ""
                            )}
                            title={collapsed ? "Connect Wallet" : undefined}
                        >
                            <Wallet className="w-5 h-5 transition-transform group-hover:scale-110" />
                            {!collapsed && <span className="font-medium text-sm">Connect Wallet</span>}
                        </button>
                    )}

                    {isConnected && isAdmin && (
                        <Link
                            href="/admin"
                            className={cn(
                                "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 group mt-4 border",
                                pathname === "/admin"
                                    ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                    : "text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/10 border-transparent hover:border-amber-500/20",
                                collapsed ? "justify-center" : ""
                            )}
                            title={collapsed ? "Admin Panel" : undefined}
                        >
                            <Shield className="w-5 h-5" />
                            {!collapsed && <span className="font-medium text-sm">Admin Panel</span>}
                        </Link>
                    )}
                </nav>

                {!collapsed && (
                    <div className="pt-4 border-t border-white/10 text-center">
                        <span className="text-[10px] text-white/20">Powered by BNB Chain</span>
                    </div>
                )}
            </div>
        </>
    );
}
