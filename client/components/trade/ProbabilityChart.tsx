import LogoBrand from "@/components/ui/LogoBrand";

// ... existing imports

export default function ProbabilityChart({ outcome = "YES" }: { outcome?: "YES" | "NO" }) {
    const color = outcome === "YES" ? "#4ADE80" : "#F87171";
    return (
        <div className="w-full h-[400px] relative">
            {/* Watermark Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.03]">
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
