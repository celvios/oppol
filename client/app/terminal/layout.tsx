"use client";

import { Sidebar } from "@/components/dashboard/Sidebar";
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
        <div className="min-h-screen bg-background text-white flex">
            <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
            <main
                className={cn(
                    "flex-1 p-8 relative overflow-hidden transition-all duration-300",
                    collapsed ? "ml-20" : "ml-64"
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
        </div>
    );
}
