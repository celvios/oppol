"use client";

import { lazy, Suspense } from "react";
import LogoBrand from "@/components/ui/LogoBrand";

// Lazy load Recharts components
const AreaChart = lazy(() => import("recharts").then(m => ({ default: m.AreaChart })));
const Area = lazy(() => import("recharts").then(m => ({ default: m.Area })));
const XAxis = lazy(() => import("recharts").then(m => ({ default: m.XAxis })));
const YAxis = lazy(() => import("recharts").then(m => ({ default: m.YAxis })));
const Tooltip = lazy(() => import("recharts").then(m => ({ default: m.Tooltip })));
const ResponsiveContainer = lazy(() => import("recharts").then(m => ({ default: m.ResponsiveContainer })));

const data = [
    { time: "10:00", prob: 0.45 },
    { time: "11:00", prob: 0.52 },
    { time: "12:00", prob: 0.49 },
    { time: "13:00", prob: 0.60 },
    { time: "14:00", prob: 0.58 },
    { time: "15:00", prob: 0.65 },
    { time: "16:00", prob: 0.68 },
    { time: "17:00", prob: 0.72 },
];

export default function ProbabilityChart({ outcome = "YES" }: { outcome?: "YES" | "NO" }) {
    const color = outcome === "YES" ? "#4ADE80" : "#F87171";
    return (
        <div className="w-full h-[400px] relative">
            {/* Watermark Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.1]">
                <LogoBrand size="xl" />
            </div>

            <Suspense fallback={<div className="w-full h-full bg-white/5 rounded-lg animate-pulse" />}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="probGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="time"
                            stroke="#94A3B8"
                            tick={{ fill: '#94A3B8', fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            hide
                            domain={[0, 1]}
                        />
                        <Area
                            type="monotone"
                            dataKey="prob"
                            stroke={color}
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#probGradient)"
                            animationDuration={0}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </Suspense>
        </div>
    );
}
