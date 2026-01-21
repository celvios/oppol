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
    // Size mappings for the image logo - Adjusted for full logo aspect ratio (approx 3:1)
    const sizes = {
        sm: { width: 85, height: 28 },    // 28px height base
        md: { width: 120, height: 40 },   // 40px height base
        lg: { width: 168, height: 56 },   // 56px height base
        xl: { width: 240, height: 80 }    // 80px height base
    };

    const s = sizes[size];

    const Content = () => (
        <div className={`relative ${className} flex items-center`}>
            <Image
                src="/opoll-logo.png"
                alt="OPoll"
                width={s.width}
                height={s.height}
                className={`object-contain ${animate ? 'animate-pulse' : ''}`}
                priority
            />
        </div>
    );

    if (href) {
        return (
            <Link href={href || "#"} className="hover:opacity-80 transition-opacity block">
                <Content />
            </Link>
        );
    }

    return <Content />;
}
