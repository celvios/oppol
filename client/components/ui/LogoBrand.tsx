"use client";

import React from "react";
import Link from "next/link";

interface LogoBrandProps {
    className?: string;
    size?: "sm" | "md" | "lg" | "xl";
    href?: string;
    animate?: boolean;
}

export default function LogoBrand({ className = "", size = "md", href, animate = false }: LogoBrandProps) {
    // Proportions: The logo (O) should match the cap height of the text (POLL).
    // Adjusted for semantic sizing:
    // sm: Navbar/UI (Compact)
    // md: Footer/Headings (Standard)
    // lg: Mobile Hero (Large)
    // xl: Desktop Hero (Massive)
    const sizes = {
        sm: { icon: "w-6 h-6", text: "text-lg", gap: "gap-1", subtext: "text-[8px] mt-[1px]" },
        md: { icon: "w-10 h-10", text: "text-3xl", gap: "gap-2", subtext: "text-[10px] mt-0.5" },
        lg: { icon: "w-16 h-16", text: "text-5xl", gap: "gap-3", subtext: "text-xs mt-1" },
        xl: { icon: "w-24 h-24 md:w-32 md:h-32", text: "text-7xl md:text-9xl", gap: "gap-4", subtext: "text-base mt-2" }
    };

    const s = sizes[size];

    const Content = () => (
        <div className={`flex items-center ${s.gap} ${className}`}>
            {/* The Logo (Replacing 'O') */}
            <div className={`relative ${s.icon} flex-shrink-0 flex items-center justify-center`}>
                {/* Using standard img tag for simplicity with user uploaded path */}
                <img
                    src="/brand-logo.png"
                    alt="O"
                    className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(0,240,255,0.4)]"
                />
            </div>

            <div className="flex flex-col justify-center">
                {/* POLL Text - Carefully aligned to baseline of the logo */}
                <span className={`font-heading font-bold ${s.text} leading-none tracking-widest text-white relative`}>
                    POLL
                </span>

                {/* Subtext - Hidden for XL (Hero) to avoid cluttering the main "PROTOCOL" title below it, 
                    OR kept if "blend" implies full lockup.
                    User screenshot had "OPOLL" then "SYSTEM ONLINE". 
                    I'll hide subtext for XL to match the simple "OPOLL" look requested. 
                */}
                {size !== 'sm' && size !== 'xl' && (
                    <span className={`font-mono ${s.subtext} text-neon-cyan tracking-[0.3em] leading-none opacity-80`}>
                        PREDICTION MARKET
                    </span>
                )}
            </div>
        </div>
    );

    if (href) {
        return (
            <Link href={href || "#"} className="hover:opacity-80 transition-opacity">
                <Content />
            </Link>
        );
    }

    return <Content />;
}
