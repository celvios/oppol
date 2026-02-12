"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Wallet, PlusCircle, Globe, Trophy, User, Menu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { twMerge } from "tailwind-merge";
import { useState } from "react";
import { useUIStore } from "@/lib/store";
import { ConnectWallet } from "@/components/ui/ConnectWallet";
import { useBC400Check } from "@/lib/use-bc400";
import BC400PurchaseModal from "@/components/modals/BC400PurchaseModal";
import { useWallet } from "@/lib/use-wallet";

export default function BottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { isTradeModalOpen, isInputFocused, isCommentsOpen } = useUIStore();
    const { isConnected, connect } = useWallet();
    const { hasNFT } = useBC400Check();

    const [showWalletModal, setShowWalletModal] = useState(false);
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);

    if (isTradeModalOpen || isInputFocused || isCommentsOpen) return null;

    const handleCreateClick = (e: React.MouseEvent) => {
        e.preventDefault();

        if (!isConnected) {
            connect();
            return;
        }

        if (hasNFT) {
            router.push('/admin/create-market');
        } else {
            setShowPurchaseModal(true);
        }
    };

    return (
        <>
            <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden" suppressHydrationWarning={true}>
                <div className="absolute inset-0 bg-void/80 backdrop-blur-xl border-t border-white/5" suppressHydrationWarning={true} />

                <nav className="relative flex justify-around items-center h-20 pb-2" suppressHydrationWarning={true}>
                    {/* Markets (Replaces Home) */}
                    <Link
                        href="/"
                        className="flex flex-col items-center justify-center w-full h-full text-xs font-medium gap-1 relative"
                    >
                        {pathname === "/" && (
                            <div
                                className="absolute -top-[1px] w-12 h-1 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                            />
                        )}
                        <Globe className={twMerge("w-6 h-6 transition-colors", pathname === "/" ? "text-white" : "text-text-secondary")} />
                        <span className={twMerge("transition-colors", pathname === "/" ? "text-white" : "text-text-secondary")}>Markets</span>
                    </Link>

                    {/* Leaderboard */}
                    <div
                        onClick={() => alert("Leaderboard Coming Soon!")}
                        className="flex flex-col items-center justify-center w-full h-full text-xs font-medium gap-1 relative cursor-pointer"
                    >
                        <Trophy className="w-6 h-6 text-text-secondary transition-colors" />
                        <span className="text-text-secondary transition-colors">LeaderBoard</span>
                    </div>

                    {/* Create Poll */}
                    <div
                        onClick={handleCreateClick}
                        className="flex flex-col items-center justify-center w-full h-full text-xs font-medium gap-1 relative cursor-pointer"
                    >
                        {pathname === "/admin/create-market" && (
                            <div
                                className="absolute -top-[1px] w-12 h-1 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                            />
                        )}
                        <PlusCircle className={twMerge("w-6 h-6 transition-colors", pathname === "/admin/create-market" ? "text-white" : "text-text-secondary")} />
                        <span className={twMerge("transition-colors", pathname === "/admin/create-market" ? "text-white" : "text-text-secondary")}>Create Poll</span>
                    </div>

                    {/* Portfolio */}
                    <Link
                        href="/portfolio"
                        className="flex flex-col items-center justify-center w-full h-full text-xs font-medium gap-1 relative"
                    >
                        {pathname === "/portfolio" && (
                            <div
                                className="absolute -top-[1px] w-12 h-1 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                            />
                        )}
                        <Wallet className={twMerge("w-6 h-6 transition-colors", pathname === "/portfolio" ? "text-white" : "text-text-secondary")} />
                        <span className={twMerge("transition-colors", pathname === "/portfolio" ? "text-white" : "text-text-secondary")}>Portfolio</span>
                    </Link>





                    {/* Menu */}
                    <Link
                        href="/menu"
                        className="flex flex-col items-center justify-center w-full h-full text-xs font-medium gap-1 relative"
                    >
                        {pathname === "/menu" && (
                            <div
                                className="absolute -top-[1px] w-12 h-1 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                            />
                        )}
                        <Menu className={twMerge("w-6 h-6 transition-colors", pathname === "/menu" ? "text-white" : "text-text-secondary")} />
                        <span className={twMerge("transition-colors", pathname === "/menu" ? "text-white" : "text-text-secondary")}>Menu</span>
                    </Link>
                </nav>
            </div>

            <BC400PurchaseModal
                isOpen={showPurchaseModal}
                onClose={() => setShowPurchaseModal(false)}
            />
        </>
    );
}

