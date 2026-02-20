"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import LogoBrand from "@/components/ui/LogoBrand";
import { format } from "date-fns";

// Lazy load Recharts components
const AreaChart = lazy(() => import("recharts").then(m => ({ default: m.AreaChart })));
const Area = lazy(() => import("recharts").then(m => ({ default: m.Area })));
const XAxis = lazy(() => import("recharts").then(m => ({ default: m.XAxis })));
const YAxis = lazy(() => import("recharts").then(m => ({ default: m.YAxis })));
const Tooltip = lazy(() => import("recharts").then(m => ({ default: m.Tooltip })));
const ResponsiveContainer = lazy(() => import("recharts").then(m => ({ default: m.ResponsiveContainer })));
const ReferenceLine = lazy(() => import("recharts").then(m => ({ default: m.ReferenceLine })));

interface PricePoint {
    time: string;
    prob: number;
    displayTime?: string;
}

type Interval = "1h" | "1d" | "all";

const INTERVALS: { label: string; value: Interval }[] = [
    { label: "1H", value: "1h" },
    { label: "1D", value: "1d" },
    { label: "ALL", value: "all" },
];

export default function ProbabilityChart({
    outcome = "YES",
    marketId,
}: {
    outcome?: "YES" | "NO";
    marketId?: number;
}) {
    const color = outcome === "YES" ? "#4ADE80" : "#F87171";
    const [interval, setInterval] = useState<Interval>("all");
    const [data, setData] = useState<PricePoint[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!marketId) return;

        const fetchHistory = async () => {
            setLoading(true);
            setError(false);
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
                const res = await fetch(
                    `${apiUrl}/api/markets/${marketId}/price-history?interval=${interval}`
                );
                const json = await res.json();

                if (json.success && Array.isArray(json.history) && json.history.length > 0) {
                    const formatted = json.history.map((pt: { time: string; prob: number }) => ({
                        time: pt.time,
                        // For NO outcome, flip the probability
                        prob: outcome === "NO" ? 1 - pt.prob : pt.prob,
                        displayTime: formatTimeForInterval(pt.time, interval),
                    }));
                    setData(formatted);
                } else {
                    setData([]);
                }
            } catch (e) {
                console.error("[ProbabilityChart] Failed to fetch price history:", e);
                setError(true);
                setData([]);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [marketId, interval, outcome]);

    const currentProb = data.length > 0 ? data[data.length - 1].prob : null;
    const startProb = data.length > 0 ? data[0].prob : null;
    const change = currentProb !== null && startProb !== null ? currentProb - startProb : null;

    return (
        <div className="w-full h-full flex flex-col">
            {/* Header row: current prob + interval selector */}
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-3">
                    {currentProb !== null && (
                        <>
                            <span className="text-2xl font-mono font-bold" style={{ color }}>
                                {(currentProb * 100).toFixed(1)}%
                            </span>
                            {change !== null && (
                                <span
                                    className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${change >= 0
                                            ? "text-green-400 bg-green-400/10"
                                            : "text-red-400 bg-red-400/10"
                                        }`}
                                >
                                    {change >= 0 ? "▲" : "▼"} {Math.abs(change * 100).toFixed(1)}%
                                </span>
                            )}
                        </>
                    )}
                </div>
                <div className="flex gap-1">
                    {INTERVALS.map((iv) => (
                        <button
                            key={iv.value}
                            onClick={() => setInterval(iv.value)}
                            className={`px-2.5 py-1 text-xs rounded font-mono transition-all ${interval === iv.value
                                    ? "bg-white/15 text-white"
                                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                                }`}
                        >
                            {iv.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart area */}
            <div className="flex-1 relative min-h-0">
                {/* Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.06]">
                    <LogoBrand size="xl" />
                </div>

                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="flex gap-1">
                            {[0, 1, 2].map((i) => (
                                <div
                                    key={i}
                                    className="w-1.5 h-4 rounded-full animate-pulse"
                                    style={{
                                        backgroundColor: color,
                                        opacity: 0.6,
                                        animationDelay: `${i * 150}ms`,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {!loading && (data.length === 0 || error) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-2">
                        <span className="text-white/20 text-sm">No trade history yet</span>
                        <span className="text-white/10 text-xs font-mono">
                            Chart will populate as trades occur
                        </span>
                    </div>
                )}

                <Suspense fallback={<div className="w-full h-full bg-white/5 rounded-lg animate-pulse" />}>
                    {data.length > 0 && !loading && (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id={`probGradient-${outcome}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="displayTime"
                                    stroke="transparent"
                                    tick={{ fill: "#94A3B8", fontSize: 10 }}
                                    axisLine={false}
                                    tickLine={false}
                                    interval="preserveStartEnd"
                                />
                                <YAxis
                                    domain={[0, 1]}
                                    tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                                    tick={{ fill: "#94A3B8", fontSize: 10 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={38}
                                />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (!active || !payload?.length) return null;
                                        const pt = payload[0].payload as PricePoint;
                                        return (
                                            <div className="bg-surface/90 backdrop-blur border border-white/10 rounded-lg px-3 py-2 text-xs">
                                                <div className="text-white/50 mb-1">{pt.displayTime}</div>
                                                <div className="font-mono font-bold" style={{ color }}>
                                                    {outcome} {(pt.prob * 100).toFixed(1)}%
                                                </div>
                                            </div>
                                        );
                                    }}
                                />
                                <ReferenceLine y={0.5} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
                                <Area
                                    type="monotone"
                                    dataKey="prob"
                                    stroke={color}
                                    strokeWidth={2.5}
                                    fillOpacity={1}
                                    fill={`url(#probGradient-${outcome})`}
                                    dot={false}
                                    activeDot={{ r: 4, fill: color, stroke: "white", strokeWidth: 1.5 }}
                                    animationDuration={600}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </Suspense>
            </div>
        </div>
    );
}

function formatTimeForInterval(time: string, interval: Interval): string {
    try {
        const d = new Date(time);
        if (interval === "1h") return format(d, "HH:mm");
        if (interval === "1d") return format(d, "MMM d HH:mm");
        return format(d, "MMM d");
    } catch {
        return time;
    }
}
