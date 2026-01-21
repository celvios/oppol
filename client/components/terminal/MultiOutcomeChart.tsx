"use strict";

import { useMemo } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    ResponsiveContainer,
    CartesianGrid,
    Tooltip,
    Legend
} from 'recharts';

interface MultiOutcomeChartProps {
    data: any[]; // Array of history points
    outcomes: string[]; // List of outcome names
    height?: number | string;
}

// Neon color palette matching the theme
const COLORS = [
    "#27E8A7", // Neon Green
    "#00F0FF", // Neon Cyan
    "#FF2E63", // Neon Coral
    "#9D4EDD", // Neon Purple
    "#FFD700", // Gold
    "#FF8C00", // Orange
    "#0077B6", // Ocean Blue
    "#F72585", // Pink
];

export function MultiOutcomeChart({ data, outcomes, height = "100%" }: MultiOutcomeChartProps) {

    // Create gradients definition
    const gradients = useMemo(() => (
        <defs>
            {outcomes.map((outcome, index) => {
                let color;
                const lower = outcome.toLowerCase();
                if (lower === 'yes') color = '#27E8A7'; // Neon Green
                else if (lower === 'no') color = '#FF2E63'; // Neon Coral/Red
                else color = COLORS[index % COLORS.length];

                return (
                    <linearGradient key={outcome} id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                );
            })}
        </defs>
    ), [outcomes]);

    if (!outcomes || outcomes.length === 0) return null;

    return (
        <div style={{ width: "100%", height }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    {gradients}
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                        dataKey="time"
                        stroke="rgba(255,255,255,0.2)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={30}
                    />
                    <YAxis
                        stroke="rgba(255,255,255,0.2)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 100]}
                        unit="%"
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'rgba(5, 5, 10, 0.9)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            backdropFilter: 'blur(10px)',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                        }}
                        itemStyle={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: '12px' }}
                        labelStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '8px' }}
                    />
                    <Legend
                        wrapperStyle={{ paddingTop: '20px' }}
                        iconType="circle"
                    />
                    {outcomes.map((outcome, index) => {
                        let color;
                        const lower = outcome.toLowerCase();
                        if (lower === 'yes') color = '#27E8A7'; // Neon Green
                        else if (lower === 'no') color = '#FF2E63'; // Neon Coral/Red
                        else color = COLORS[index % COLORS.length];

                        return (
                            <Area
                                key={outcome}
                                type="monotone"
                                dataKey={outcome} // Expecting data points like { time: '...', [outcome]: 45 }
                                name={outcome}
                                stroke={color}
                                strokeWidth={3}
                                fillOpacity={1}
                                fill={`url(#gradient-${index})`}
                                className="transition-all duration-500"
                                activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }}
                            />
                        );
                    })}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
