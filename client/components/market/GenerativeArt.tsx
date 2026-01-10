"use client";

import { useMemo } from "react";

export default function GenerativeArt({ color = "cyan" }: { color?: "cyan" | "coral" | "green" }) {
    // Generate random shapes or strict aesthetic?
    // Let's stick to a clean abstract swirl.

    const gradientId = useMemo(() => `grad-${Math.random().toString(36).substr(2, 9)}`, []);

    const colors = {
        cyan: ["#00F0FF", "#00C0FF", "#05050A"],
        coral: ["#FF2E63", "#FF0040", "#05050A"],
        green: ["#27E8A7", "#00F0FF", "#05050A"],
    };

    const palette = colors[color] || colors.cyan;

    return (
        <div className="w-full h-full relative overflow-hidden bg-void/50">
            <svg
                viewBox="0 0 200 200"
                className="w-full h-full absolute inset-0 opacity-80 mix-blend-screen"
                preserveAspectRatio="none"
            >
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={palette[0]} />
                        <stop offset="50%" stopColor={palette[1]} />
                        <stop offset="100%" stopColor={palette[2]} />
                    </linearGradient>
                    <filter id="blurFilters">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="15" />
                    </filter>
                </defs>

                <g filter="url(#blurFilters)">
                    <circle cx="50" cy="50" r="80" fill={`url(#${gradientId})`} className="animate-float" style={{ animationDuration: '8s' }} />
                    <circle cx="150" cy="150" r="60" fill={palette[0]} fillOpacity="0.5" className="animate-float" style={{ animationDuration: '6s', animationDelay: '1s' }} />
                </g>
            </svg>

            {/* Overlay Grid */}
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        </div>
    );
}
