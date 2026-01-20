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
        sm: { icon: "text-lg", text: "text-lg", gap: "gap-0.5", subtext: "text-[8px] mt-[1px]" },
        md: { icon: "text-3xl", text: "text-3xl", gap: "gap-0.5", subtext: "text-[10px] mt-0.5" },
        lg: { icon: "text-5xl", text: "text-5xl", gap: "gap-0.5", subtext: "text-xs mt-1" },
        xl: { icon: "text-7xl md:text-9xl", text: "text-7xl md:text-9xl", gap: "gap-1", subtext: "text-base mt-2" }
    };

    const s = sizes[size];

    const Content = () => (
        <div className={`flex flex-col justify-center ${className}`}>
            <div className={`flex items-baseline ${s.gap}`}>
                {/* The Logo (Replacing 'O') - Merged baseline */}
                <span className={`font-heading font-bold text-neon-cyan drop-shadow-[0_0_15px_rgba(0,240,255,0.4)] ${s.icon} leading-none`}>
                    O
                </span>

                {/* POLL Text */}
                <span className={`font-heading font-bold ${s.text} leading-none tracking-widest text-white`}>
                    POLL
                </span>
            </div>

            {/* Subtext */}
            {size !== 'sm' && size !== 'xl' && (
                <span className={`font-mono ${s.subtext} text-neon-cyan tracking-[0.3em] leading-none opacity-80 self-start`}>
                    PREDICTION MARKET
                </span>
            )}
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
