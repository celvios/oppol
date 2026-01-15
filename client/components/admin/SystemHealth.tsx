"use client";

import { useState, useEffect } from "react";
import { Activity, Database, Wallet, Server, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";

interface HealthData {
    rpc: string;
    blockNumber: number;
    database: string;
    wallet: {
        address: string;
        bnb: string;
        usdc: string;
    };
    timestamp: string;
}

export default function SystemHealth({ adminKey }: { adminKey: string }) {
    const [health, setHealth] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchHealth = async () => {
        try {
            const res = await fetch('/api/admin/health', {
                headers: { 'x-admin-secret': adminKey }
            });
            const data = await res.json();
            if (data.success) {
                setHealth(data.health);
            }
        } catch (e) {
            console.error("Health check failed", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHealth();
        // Poll every 30s
        const interval = setInterval(fetchHealth, 30000);
        return () => clearInterval(interval);
    }, [adminKey]);

    if (loading) return null; // Or skeleton

    const StatusIcon = ({ status }: { status: string }) => {
        if (status === 'OK') return <CheckCircle className="text-neon-green" size={16} />;
        if (status === 'ERROR') return <XCircle className="text-neon-coral" size={16} />;
        return <AlertTriangle className="text-neon-gold" size={16} />;
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* RPC Node */}
            <GlassCard className="p-4 flex items-center gap-4 relative overflow-hidden group">
                <div className="absolute inset-0 bg-neon-cyan/5 group-hover:bg-neon-cyan/10 transition-colors" />
                <div className="p-3 bg-black/40 rounded-xl relative">
                    <Server className="text-neon-cyan" size={24} />
                    <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-0.5">
                        <StatusIcon status={health?.rpc || 'UNKNOWN'} />
                    </div>
                </div>
                <div className="relative">
                    <p className="text-white/40 text-xs font-bold uppercase tracking-wider">BSC Node</p>
                    <p className="text-white font-mono font-bold text-lg">
                        #{health?.blockNumber?.toLocaleString() || '0'}
                    </p>
                    <p className="text-white/30 text-[10px]">Latency: Normal</p>
                </div>
            </GlassCard>

            {/* Database */}
            <GlassCard className="p-4 flex items-center gap-4 relative overflow-hidden group">
                <div className="absolute inset-0 bg-neon-purple/5 group-hover:bg-neon-purple/10 transition-colors" />
                <div className="p-3 bg-black/40 rounded-xl relative">
                    <Database className="text-neon-purple" size={24} />
                    <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-0.5">
                        <StatusIcon status={health?.database || 'UNKNOWN'} />
                    </div>
                </div>
                <div className="relative">
                    <p className="text-white/40 text-xs font-bold uppercase tracking-wider">Database</p>
                    <p className="text-white font-bold text-lg">
                        {health?.database === 'OK' ? 'Connected' : 'Error'}
                    </p>
                    <p className="text-white/30 text-[10px]">PostgreSQL</p>
                </div>
            </GlassCard>

            {/* Relayer Wallet */}
            <GlassCard className="p-4 flex items-center gap-4 relative overflow-hidden group">
                <div className="absolute inset-0 bg-neon-gold/5 group-hover:bg-neon-gold/10 transition-colors" />
                <div className="p-3 bg-black/40 rounded-xl relative">
                    <Wallet className="text-neon-gold" size={24} />
                </div>
                <div className="relative flex-1">
                    <p className="text-white/40 text-xs font-bold uppercase tracking-wider">Relayer Wallet</p>
                    <div className="flex justify-between items-center">
                        <span className="text-white font-mono font-bold">{parseFloat(health?.wallet?.bnb || '0').toFixed(4)} BNB</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-white/60 text-xs font-mono">${parseFloat(health?.wallet?.usdc || '0').toFixed(2)} USDC</span>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
}
