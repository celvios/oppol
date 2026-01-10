"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

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
        <div className="w-full h-[400px]">
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
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'rgba(5, 5, 10, 0.8)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: '#fff'
                        }}
                        itemStyle={{ color: color }}
                        formatter={(value: number) => [`${(value * 100).toFixed(0)}%`, "Probability"]}
                    />
                    <Area
                        type="monotone"
                        dataKey="prob"
                        stroke={color}
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#probGradient)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
