"use client";

import { Sidebar } from "@/components/dashboard/Sidebar";
import BottomNav from "@/components/mobile/BottomNav";
import { motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";
import DesktopFooter from "./DesktopFooter";

export default function ClientShell({
    children,
}: {
    children: React.ReactNode;
}) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="min-h-screen bg-background text-white flex flex-col md:flex-row">
            {/* Desktop Sidebar - Hidden on Mobile */}
            <div className="hidden md:block z-50">
                <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
            </div>

            <main
                className={cn(
                    "flex-1 relative overflow-y-auto overflow-x-hidden transition-all duration-300 flex flex-col",
                    "p-0 md:p-8",
                    // Margin logic for desktop sidebar
                    collapsed ? "md:ml-20" : "md:ml-64"
                )}
            >
                {/* Ambient Top Glow */}
                {/* Ambient Top Glow - Removed blue gradient */}
                {/* <div className="absolute top-0 left-0 w-full h-[300px] bg-primary/5 blur-[120px] pointer-events-none" /> */}

                <motion.div className="relative z-10">
                    {children}
                </motion.div>

                {/* Desktop Footer - Hidden on Mobile */}
                <div className="hidden md:block mt-auto">
                    <DesktopFooter />
                </div>
            </main>

            {/* Mobile Bottom Navigation - Visible only on Mobile */}
            <div className="md:hidden">
                <BottomNav />
            </div>
        </div>
    );
}
