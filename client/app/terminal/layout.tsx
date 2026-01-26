"use client";

import { Sidebar } from "@/components/dashboard/Sidebar";
import BottomNav from "@/components/mobile/BottomNav";
import LogoBrand from "@/components/ui/LogoBrand";
import { motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function TerminalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="min-h-screen bg-background text-white flex flex-col md:flex-row">
            {/* DEBUG: Remove after confirming layout activity */}
            <div className="fixed top-20 left-20 z-[9999] bg-red-600 px-4 py-2 font-bold border-2 border-white">
                TERMINAL LAYOUT ACTIVE
            </div>

            {/* Desktop Sidebar - Hidden on Mobile */}
            <div className="hidden md:block z-50">
                <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
            </div>

            <main
                className={cn(
                    "flex-1 relative overflow-y-auto overflow-x-hidden transition-all duration-300",
                    "p-0 md:p-8", // Removed top padding
                    // Margin logic for desktop sidebar
                    collapsed ? "md:ml-20" : "md:ml-64"
                )}
            >
                {/* Ambient Top Glow */}
                <div className="absolute top-0 left-0 w-full h-[300px] bg-primary/5 blur-[120px] pointer-events-none" />

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="relative z-10"
                >
                    {children}
                </motion.div>
            </main>

            {/* Mobile Bottom Navigation - Visible only on Mobile */}
            <div className="md:hidden">
                <BottomNav />
            </div>
        </div>
    );
}
