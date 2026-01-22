"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Shield, Activity, DollarSign, Users, RefreshCw, BarChart3, Lock, Tag } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import NeonButton from "@/components/ui/NeonButton";
import SystemHealth from "@/components/admin/SystemHealth";

export default function AdminDashboard() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [adminKey, setAdminKey] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    // Stats State
    const [stats, setStats] = useState({
        totalLiquidity: "$0.00",
        totalVolume: "$0.00",
        activeMarkets: 0,
        totalUsers: 0,
        // Trend data
        volumeTrend: "Loading...",
        liquidityTrend: "Loading...",
        expiringMarkets: 0,
        newUsersToday: 0
    });

    // Check local storage on load
    useEffect(() => {
        const savedKey = localStorage.getItem("admin_secret");
        if (savedKey) {
            verifyKey(savedKey);
        }
    }, []);

    const verifyKey = async (key: string) => {
        setIsLoading(true);
        setError("");

        try {
            // Verify against health endpoint
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

            // Try specific admin health first, fallback to general health
            let res;
            try {
                res = await fetch(`${apiUrl}/api/admin/health`, {
                    headers: { 'x-admin-secret': key }
                });
            } catch (err) {
                // Try fallback
                console.log("Admin health check failed, trying general health...");
                res = await fetch(`${apiUrl}/api/health`, {
                    headers: { 'x-admin-secret': key }
                });
            }

            if (res.ok) {
                setIsAuthenticated(true);
                localStorage.setItem("admin_secret", key);
                fetchStats(key);
            } else {
                if (res.status === 401) {
                    setError("Invalid admin key");
                    localStorage.removeItem("admin_secret");
                } else if (res.status === 404) {
                    setError("API endpoint not found (404)");
                } else {
                    setError(`Server error: ${res.statusText}`);
                }
            }
        } catch (e) {
            setError("Connection failed. Check authentication or network.");
            localStorage.removeItem("admin_secret");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchStats = async (key: string) => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const res = await fetch(`${apiUrl}/api/admin/stats`, {
                headers: { 'x-admin-secret': key }
            });
            const data = await res.json();

            if (data.success) {
                setStats(data.stats);
            } else {
                setError(data.error || "Failed to fetch stats");
            }
        } catch (e) {
            console.error("Stats fetch error:", e);
            setError("Network error fetching stats");
        }
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        verifyKey(adminKey);
    };

    const handleLogout = () => {
        localStorage.removeItem("admin_secret");
        setIsAuthenticated(false);
        setAdminKey("");
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-void flex items-center justify-center p-4">
                <GlassCard className="max-w-md w-full p-8 ml-0">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 text-neon-cyan">
                            <Lock size={32} />
                        </div>
                        <h1 className="text-2xl font-heading font-bold text-white">Admin Access</h1>
                        <p className="text-text-secondary text-sm mt-2">Enter security key to continue</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <input
                                type="password"
                                value={adminKey}
                                onChange={(e) => setAdminKey(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-cyan/50 transition-colors font-mono"
                                placeholder="Security Key"
                            />
                        </div>

                        {error && (
                            <p className="text-neon-coral text-sm text-center bg-neon-coral/10 p-2 rounded">
                                {error}
                            </p>
                        )}

                        <NeonButton
                            variant="primary"
                            className="w-full"
                            disabled={isLoading}
                            type="submit"
                        >
                            {isLoading ? "Verifying..." : "Access Dashboard"}
                        </NeonButton>
                    </form>
                </GlassCard>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-void pb-20 pt-24 px-4 md:px-6">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-heading font-bold text-white mb-2">Admin Dashboard</h1>
                        <p className="text-text-secondary">System overview and management</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors"
                        >
                            Logout
                        </button>
                        <NeonButton variant="secondary" icon={RefreshCw} onClick={() => fetchStats(adminKey)}>
                            Refresh
                        </NeonButton>
                    </div>
                </div>

                {/* System Health */}
                {isAuthenticated && <SystemHealth adminKey={adminKey} />}

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        title="Total Volume"
                        value={stats.totalVolume}
                        icon={Activity}
                        trend={stats.volumeTrend || "N/A"}
                        color="text-neon-cyan"
                    />
                    <StatCard
                        title="Total Liquidity"
                        value={stats.totalLiquidity}
                        icon={DollarSign}
                        trend={stats.liquidityTrend || "N/A"}
                        color="text-neon-green"
                    />
                    <StatCard
                        title="Active Markets"
                        value={stats.activeMarkets}
                        icon={BarChart3}
                        trend={stats.expiringMarkets > 0 ? `${stats.expiringMarkets} expiring soon` : "None expiring soon"}
                        color="text-neon-purple"
                    />
                    <StatCard
                        title="Total Users"
                        value={stats.totalUsers}
                        icon={Users}
                        trend={stats.newUsersToday > 0 ? `+${stats.newUsersToday} new today` : "No new users today"}
                        color="text-neon-gold"
                    />
                </div>

                {/* Quick Actions */}
                <h2 className="text-xl font-heading font-bold text-white mt-12 mb-6">Management</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <ActionCard
                        title="Create Market"
                        description="Launch a new binary or multi-outcome market"
                        icon={Shield}
                        href="/admin/create-market"
                    />
                    <ActionCard
                        title="Resolve Market"
                        description="Set outcomes for ended markets"
                        icon={Shield}
                        href="/admin/markets"
                    />
                    <ActionCard
                        title="Categories"
                        description="Manage market categories"
                        icon={Tag}
                        href="/admin/categories"
                    />
                    <ActionCard
                        title="User Management"
                        description="View users and manage permissions"
                        icon={Users}
                        href="/admin/users"
                    />
                </div>
            </div>
        </div >
    );
}

function StatCard({ title, value, icon: Icon, trend, color }: any) {
    return (
        <GlassCard className="p-6">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-white/50 text-sm font-medium mb-1">{title}</h3>
                    <div className="text-2xl font-bold text-white font-mono">{value}</div>
                </div>
                <div className={`p-2 rounded-lg bg-white/5 ${color}`}>
                    <Icon size={20} />
                </div>
            </div>
            <div className="text-xs text-text-secondary">
                {trend}
            </div>
        </GlassCard>
    );
}

function ActionCard({ title, description, icon: Icon, href }: any) {
    return (
        <Link href={href} className="group text-left block h-full">
            <GlassCard className="p-6 h-full hover:bg-white/10 transition-colors border-white/5 hover:border-neon-cyan/30">
                <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-neon-cyan mb-4 group-hover:scale-110 transition-transform">
                    <Icon size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-white/50 text-sm">{description}</p>
            </GlassCard>
        </Link>
    );
}
