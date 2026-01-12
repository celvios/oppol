"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, BarChart2, Search, Wallet, User, LayoutGrid } from "lucide-react";
import { motion } from "framer-motion";
import { twMerge } from "tailwind-merge";
import { useState, useEffect } from "react";
import { useDisconnect } from "wagmi";

import { useUIStore } from "@/lib/store";
// import { useEIP6963 } from "@/lib/useEIP6963"; // Removed
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useWallet } from "@/lib/use-wallet";

export default function BottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { isTradeModalOpen } = useUIStore();
    const { isConnected, address } = useWallet();
    const { disconnect: wagmiDisconnect } = useDisconnect();
    // EIP-6963 logic removed
    const { open } = useWeb3Modal();

    const handleLogout = () => {
        // Clear all session data
        localStorage.removeItem('session_token');
        localStorage.removeItem('cached_wallet_address');
        localStorage.removeItem('connected_wallet_uuid');
        localStorage.removeItem('connected_wallet_name');

        // Disconnect Wagmi/Reown
        wagmiDisconnect();

        // Disconnect EIP-6963 wallet if connected
        // Disconnect EIP-6963 wallet if connected (Removed)

        // Redirect to homepage
        router.push('/');
    };

    // Wagmi (includes custodial via useWallet)
    const isLoggedIn = isConnected;

    if (isTradeModalOpen) return null;

    const navItems = [
        { name: "Terminal", icon: Home, href: "/terminal" },
        { name: "Markets", icon: LayoutGrid, href: "/markets" },
        { name: "Search", icon: Search, href: "/search" },
        { name: "Portfolio", icon: BarChart2, href: "/terminal/portfolio" },
    ];

    return (
        <>
            <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
                {/* Glass Container */}
                <div className="absolute inset-0 bg-void/80 backdrop-blur-xl border-t border-white/5" />

                <nav className="relative flex justify-around items-center h-20 pb-2">
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

                    {/* Wallet Button */}
                    {isLoggedIn ? (
                        <div className="flex flex-col items-center justify-center w-full h-full text-xs font-medium gap-1 relative">
                            <button
                                onClick={handleLogout}
                                className="flex flex-col items-center gap-1"
                            >
                                <div className="relative">
                                    {isConnected ? (
                                        <Wallet className="w-6 h-6 text-primary" />
                                    ) : (
                                        <User className="w-6 h-6 text-primary" />
                                    )}
                                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_#00E0FF]" />
                                </div>
                                <span className="text-primary text-[10px] font-mono">
                                    {isConnected && address
                                        ? `${address.slice(0, 4)}...${address.slice(-3)}`
                                        : 'Logout'
                                    }
                                </span>
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => open()}
                            className="flex flex-col items-center justify-center w-full h-full text-xs font-medium gap-1 relative"
                        >
                            <Wallet className="w-6 h-6 text-text-secondary" />
                            <span className="text-text-secondary">Wallet</span>
                        </button>
                    )}
                </nav>
            </div>

            {/* Wallet Selector Modal */}
            {/* Wallet Selector Modal Removed */
            /* <WalletSelectorModal ... /> */}
        </>
    );
}
