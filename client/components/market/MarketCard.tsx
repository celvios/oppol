"use client";

import GlassCard from "@/components/ui/GlassCard";
import GenerativeArt from "./GenerativeArt";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

interface MarketCardProps {
    id: string;
    title: string;
    volume: string;
    outcomeA: string; // e.g. "Yes"
    outcomeB: string; // e.g. "No"
    probA: number; // 0.65
    color?: "cyan" | "coral" | "green";
}

export default function MarketCard({ id, title, volume, outcomeA, outcomeB, probA, color = "cyan" }: MarketCardProps) {
    const probB = 1 - probA;
    const percentA = Math.round(probA * 100);
    const percentB = Math.round(probB * 100);

    return (
        <Link href={`/markets/${id}`}>
            <GlassCard
                className="h-64 group cursor-pointer border-white/5 hover:border-outcome-a/30"
                whileHover={{ y: -5, scale: 1.02 }}
            >
                {/* Visual Header */}
                <div className="absolute inset-0 h-32 z-0">
                    <GenerativeArt color={color} />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-void" />
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-end h-full p-5">

                    {/* Title */}
                    <div className="mb-4">
                        <h3 className="text-xl font-heading font-bold leading-tight group-hover:text-outcome-a transition-colors">
                            {title}
                        </h3>
                        <p className="text-xs text-text-secondary mt-1 font-mono">Vol: {volume}</p>
                    </div>

                    {/* Probability Bar */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-mono uppercase tracking-wider">
                            <span className="text-outcome-a">{outcomeA} {percentA}%</span>
                            <span className="text-outcome-b">{percentB}% {outcomeB}</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden flex">
                            <div
                                className="h-full bg-outcome-a shadow-[0_0_10px_vars(--outcome-a)] transition-all duration-1000"
                                style={{ width: `${percentA}%` }}
                            />
                            <div
                                className="h-full bg-outcome-b shadow-[0_0_10px_vars(--outcome-b)] transition-all duration-1000"
                                style={{ width: `${percentB}%` }}
                            />
                        </div>
                    </div>

                    {/* Hover Action */}
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                        <div className="p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
                            <ArrowUpRight className="w-4 h-4 text-white" />
                        </div>
                    </div>
                </div>
            </GlassCard>
        </Link>
    );
}
