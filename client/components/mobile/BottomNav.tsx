"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart2, Search, Wallet, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { twMerge } from "tailwind-merge";
import { useState } from "react";

import { useUIStore } from "@/lib/store";
import { useEIP6963 } from "@/lib/useEIP6963";
import { WalletSelectorModal } from "@/components/ui/WalletSelectorModal";

export default function BottomNav() {
    const pathname = usePathname();
    const { isTradeModalOpen } = useUIStore();
    const {
        wallets,
        walletState,
        isConnecting,
        error,
        connect,
        connectMetaMaskSDK,
        disconnect,
        isMobile,
    } = useEIP6963();
    const [showWalletModal, setShowWalletModal] = useState(false);

    if (isTradeModalOpen) return null;

    const navItems = [
        { name: "Terminal", icon: Home, href: "/" },
        { name: "Markets", icon: BarChart2, href: "/markets" },
        { name: "Search", icon: Search, href: "/search" },
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
                    {walletState.isConnected ? (
                        <div className="flex flex-col items-center justify-center w-full h-full text-xs font-medium gap-1 relative">
                            <button
                                onClick={disconnect}
                                className="flex flex-col items-center gap-1"
                            >
                                <div className="relative">
                                    <Wallet className="w-6 h-6 text-primary" />
                                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_#00E0FF]" />
                                </div>
                                <span className="text-primary text-[10px] font-mono">
                                    {walletState.address?.slice(0, 4)}...{walletState.address?.slice(-3)}
                                </span>
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowWalletModal(true)}
                            className="flex flex-col items-center justify-center w-full h-full text-xs font-medium gap-1 relative"
                        >
                            <Wallet className="w-6 h-6 text-text-secondary" />
                            <span className="text-text-secondary">Wallet</span>
                        </button>
                    )}
                </nav>
            </div>

            {/* Wallet Selector Modal */}
            <WalletSelectorModal
                isOpen={showWalletModal}
                onClose={() => setShowWalletModal(false)}
                wallets={wallets}
                onSelectWallet={async (wallet) => {
                    await connect(wallet);
                    setShowWalletModal(false);
                }}
                onConnectMetaMaskSDK={async () => {
                    await connectMetaMaskSDK();
                    setShowWalletModal(false);
                }}
                isConnecting={isConnecting}
                error={error}
                isMobile={isMobile}
            />
        </>
    );
}
