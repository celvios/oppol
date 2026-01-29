"use client";

import { Sidebar } from "@/components/dashboard/Sidebar";
import BottomNav from "@/components/mobile/BottomNav";
import { motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";
import LogoBrand from "@/components/ui/LogoBrand";
import { Send, MessageCircle } from "lucide-react";

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
                    "flex-1 relative overflow-y-auto overflow-x-hidden transition-all duration-300",
                    "p-0 md:p-8",
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

                    {/* Desktop Footer */}
                    <div className="hidden md:flex items-center justify-between border-t border-white/5 pt-8 mt-12 pb-4">
                        <LogoBrand size="sm" />
                        <div className="flex items-center gap-6">
                            <a href="https://t.me/opoll_predict_bot" target="_blank" rel="noreferrer" className="text-white/60 hover:text-neon-cyan transition-colors">
                                <Send className="w-5 h-5 -rotate-12" />
                            </a>
                            <a href="https://wa.me/yourwhatsapp" target="_blank" rel="noreferrer" className="text-white/60 hover:text-neon-green transition-colors">
                                <MessageCircle className="w-5 h-5" />
                            </a>
                            <a href="/docs" className="text-sm font-bold text-white/60 hover:text-white transition-colors border border-white/10 px-2 py-0.5 rounded hover:bg-white/5 uppercase tracking-wide">
                                DOC
                            </a>
                            <a href="/faq" className="text-sm font-bold text-white/60 hover:text-white transition-colors">
                                FAQ
                            </a>
                        </div>
                    </div>
                </motion.div>
            </main>

            {/* Mobile Bottom Navigation - Visible only on Mobile */}
            <div className="md:hidden">
                <BottomNav />
            </div>
        </div>
    );
}
