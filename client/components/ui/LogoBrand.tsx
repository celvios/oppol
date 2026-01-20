"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

interface LogoBrandProps {
    className?: string;
    size?: "sm" | "md" | "lg" | "xl";
    href?: string;
    animate?: boolean;
    showText?: boolean;
}

export default function LogoBrand({ className = "", size = "md", href, animate = false, showText = false }: LogoBrandProps) {
    // Size mappings for the image logo
    const sizes = {
        sm: { img: 28, text: "text-lg", subtext: "text-[8px] mt-[1px]" },
        md: { img: 40, text: "text-2xl", subtext: "text-[10px] mt-0.5" },
        lg: { img: 56, text: "text-3xl", subtext: "text-xs mt-1" },
        xl: { img: 80, text: "text-5xl md:text-6xl", subtext: "text-base mt-2" }
    };

    const s = sizes[size];

    const Content = () => (
        <div className={`flex items-center gap-2 ${className}`}>
            {/* Logo Image */}
            <Image
                src="/opoll-logo.png"
                alt="OPoll"
                width={s.img}
                height={s.img}
                className={`object-contain mix-blend-screen drop-shadow-[0_0_10px_rgba(0,240,255,0.4)] ${animate ? 'animate-pulse' : ''}`}
                priority
            />

            {/* Text branding */}
            {showText && (
                <span className={`font-heading font-bold ${s.text} leading-none tracking-wide text-white`}>
                    <span className="text-neon-cyan">O</span>Poll
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
