"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { TrendingUp, Activity, Globe, Zap } from "lucide-react";

// Mock Data for floating nodes
// Desktop Nodes
const NODES = [
    { id: 1, label: "BTC > 100k", color: "text-neon-cyan", icon: TrendingUp, x: 15, y: 25, v: 80 },
    { id: 2, label: "Fed Cut", color: "text-neon-coral", icon: Activity, x: 80, y: 35, v: -40 },
    { id: 3, label: "GTA VI", color: "text-neon-green", icon: Globe, x: 10, y: 65, v: 50 },
    { id: 4, label: "SpaceX", color: "text-white", icon: TrendingUp, x: 85, y: 60, v: -60 },
    { id: 5, label: "Nvidia", color: "text-neon-cyan", icon: Activity, x: 45, y: 15, v: 30 },
    { id: 6, label: "Election", color: "text-neon-coral", icon: Globe, x: 75, y: 80, v: 70 },
    // New Nodes
    { id: 7, label: "AI Alts", color: "text-neon-purple", icon: Zap, x: 62, y: 18, v: 45 },
    { id: 8, label: "Rates", color: "text-neon-cyan", icon: TrendingUp, x: 50, y: 88, v: -50 },
    { id: 9, label: "SOL ETF", color: "text-white", icon: Globe, x: 5, y: 48, v: 60 },
];

// Mobile Nodes - Tighter Horizontal, Clear Vertical Center (30-60% usually text)
const MOBILE_NODES = [
    { id: 1, label: "BTC > 100k", color: "text-neon-cyan", icon: TrendingUp, x: 10, y: 15, v: 40 }, // Top Left
    { id: 2, label: "Fed Cut", color: "text-neon-coral", icon: Activity, x: 75, y: 20, v: -30 }, // Top Right
    { id: 3, label: "GTA VI", color: "text-neon-green", icon: Globe, x: 10, y: 65, v: 40 }, // Bottom Left (Higher up)
    { id: 4, label: "SpaceX", color: "text-white", icon: TrendingUp, x: 75, y: 70, v: -40 }, // Bottom Right (Higher up)
    { id: 5, label: "Nvidia", color: "text-neon-cyan", icon: Activity, x: 42, y: 12, v: 20 }, // Top Center (High)
    // New Mobile Nodes
    { id: 6, label: "AI Agents", color: "text-neon-purple", icon: Zap, x: 45, y: 85, v: 35 },
    { id: 7, label: "Memes", color: "text-neon-coral", icon: Activity, x: 85, y: 45, v: -25 },
    { id: 8, label: "DeFi", color: "text-neon-green", icon: Globe, x: 5, y: 40, v: 45 },
];

function FloatingNode({ node, mouseX, mouseY }: { node: typeof NODES[0], mouseX: any, mouseY: any }) {
    // Parallax effect: The movement intensity depends on the 'v' value (depth)
    const x = useTransform(mouseX, [-1, 1], [-node.v * 1.5, node.v * 1.5]); // Increased range
    const y = useTransform(mouseY, [-1, 1], [-node.v * 1.5, node.v * 1.5]);

    return (
        <motion.div
            style={{ left: `${node.x}%`, top: `${node.y}%`, x, y }}
            className="absolute z-10 flex"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{
                opacity: 1,
                scale: 1,
                y: [0, -10, 0], // Bobbing effect
            }}
            transition={{
                delay: Math.random() * 0.5,
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut"
            }}
        >
            <div className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-lg shadow-black/20 hover:border-white/20 hover:bg-white/10 transition-colors cursor-pointer group whitespace-nowrap">
                <node.icon className={`w-3 h-3 md:w-4 md:h-4 ${node.color}`} />
                <span className="text-[10px] md:text-xs font-mono font-bold tracking-wider text-white/80 group-hover:text-white transition-colors">
                    {node.label}
                </span>
                {/* Status Dot */}
                <span className="w-1.5 h-1.5 rounded-full bg-outcome-a animate-pulse ml-1" />
            </div>
        </motion.div>
    );
}

export default function HeroInteractive({ isMobile = false }: { isMobile?: boolean }) {
    const activeNodes = isMobile ? MOBILE_NODES : NODES;
    const containerRef = useRef<HTMLDivElement>(null);
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    // Smooth spring animation for mouse movement
    const smoothX = useSpring(mouseX, { damping: 50, stiffness: 400 });
    const smoothY = useSpring(mouseY, { damping: 50, stiffness: 400 });

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const { width, height, left, top } = containerRef.current.getBoundingClientRect();

        // Normalize coordinates to -1 to 1
        const x = (e.clientX - left - width / 2) / (width / 2);
        const y = (e.clientY - top - height / 2) / (height / 2);

        mouseX.set(x);
        mouseY.set(y);
    };

    return (
        <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            className="w-full h-full absolute inset-0 z-0 overflow-hidden"
        >
            {/* Background Gradient Orbs - Brighter and Larger */}
            <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-neon-cyan/20 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow opacity-60" />
            <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-neon-coral/15 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow delay-1000 opacity-60" />

            {/* Center glow for vitality */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[100px] mix-blend-screen" />

            {/* Clean Grid - Removed Noise, purely vector lines now */}
            <div className="absolute inset-0 opacity-10 pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '50px 50px' }}
            />

            {/* Interactive Floating Nodes */}
            {activeNodes.map((node) => (
                <FloatingNode key={node.id} node={node} mouseX={smoothX} mouseY={smoothY} />
            ))}

            {/* Connecting Lines (Svg) - Optional decorative connections */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
                <motion.path
                    d="M 20% 20% Q 50% 15% 50% 15% T 80% 30%"
                    stroke="url(#gradient-line)"
                    strokeWidth="1"
                    fill="none"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 2, delay: 0.5 }}
                />
                <defs>
                    <linearGradient id="gradient-line" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(0, 240, 255, 0)" />
                        <stop offset="50%" stopColor="rgba(0, 240, 255, 1)" />
                        <stop offset="100%" stopColor="rgba(0, 240, 255, 0)" />
                    </linearGradient>
                </defs>
            </svg>
        </div>
    );
}
