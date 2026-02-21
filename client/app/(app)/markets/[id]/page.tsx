"use client";

import { useParams } from "next/navigation";
import AnimatedBackground from "@/components/ui/AnimatedBackground";
import GlassCard from "@/components/ui/GlassCard";
import NeonSlider from "@/components/ui/NeonSlider"; // Verify path
import ProbabilityChart from "@/components/trade/ProbabilityChart";
import OrderBook from "@/components/trade/OrderBook";
import { ArrowLeft, TrendingUp, Users, Clock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import MobileTradingView from "@/components/mobile/MobileTradingView";

export default function MarketPage() {
    const params = useParams();
    const id = params.id;
    const [selectedOutcome, setSelectedOutcome] = useState<"YES" | "NO">("YES");

    return (
        <div className="min-h-screen bg-void text-white pb-20">
            <AnimatedBackground />

            {/* Navigation */}
            <nav className="p-6">
                <Link href="/markets" className="inline-flex items-center text-text-secondary hover:text-white transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Markets
                </Link>
            </nav>

            {/* Mobile View */}
            <MobileTradingView
                outcome={selectedOutcome}
                setOutcome={setSelectedOutcome}
                marketId={id ? parseInt(id as string) : undefined}
            />

            <main className="hidden md:grid max-w-7xl mx-auto px-6 grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Chart & Info (2/3 width) */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Header */}
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="px-3 py-1 rounded bg-white/5 border border-white/10 text-xs font-mono text-text-secondary">POLITICS</span>
                            <span className="flex items-center gap-1 text-xs text-outcome-a font-mono">
                                <span className="relative flex h-2 w-2 mr-1">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-outcome-a opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-outcome-a"></span>
                                </span>
                                LIVE
                            </span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-heading font-bold mb-6 leading-tight">
                            Will Bitcoin hit $100k before 2026?
                        </h1>

                        {/* Stats Row */}
                        <div className="flex gap-8 text-sm text-text-secondary border-b border-white/10 pb-6">
                            <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4" /> $12.5M Vol</div>
                            <div className="flex items-center gap-2"><Users className="w-4 h-4" /> 5,231 Traders</div>
                            <div className="flex items-center gap-2"><Clock className="w-4 h-4" /> Ends Dec 31, 2025</div>
                        </div>
                    </div>

                    {/* Chart Section - "The Probability Wave" */}
                    <GlassCard className="p-6 h-[500px]">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-heading font-bold">Probability Over Time</h2>
                            <div className="flex gap-2">
                                <button className="px-3 py-1 text-xs rounded bg-white/10 text-white">1H</button>
                                <button className="px-3 py-1 text-xs rounded hover:bg-white/5 text-text-secondary">1D</button>
                                <button className="px-3 py-1 text-xs rounded hover:bg-white/5 text-text-secondary">ALL</button>
                            </div>
                        </div>
                        <ProbabilityChart outcome={selectedOutcome} />
                    </GlassCard>

                </div>

                {/* Right Column: Order Book & Trading (1/3 width) */}
                <div className="space-y-6">

                    {/* Trading Panel */}
                    <GlassCard className="p-6 border-t-4 border-t-outcome-a"> {/* Dynamic border color logic needed later */}
                        <h2 className="text-xl font-heading font-bold mb-6">Place Prediction</h2>

                        {/* Outcome Toggle */}
                        <div className="grid grid-cols-2 gap-2 mb-8 bg-black/20 p-1 rounded-xl">
                            <button
                                onClick={() => setSelectedOutcome("YES")}
                                className={`py-3 rounded-lg font-bold transition-all ${selectedOutcome === "YES" ? "bg-outcome-a text-void shadow-lg shadow-outcome-a/20" : "text-text-secondary hover:text-white"}`}
                            >
                                YES
                            </button>
                            <button
                                onClick={() => setSelectedOutcome("NO")}
                                className={`py-3 rounded-lg font-bold transition-all ${selectedOutcome === "NO" ? "bg-outcome-b text-void shadow-lg shadow-outcome-b/20" : "text-text-secondary hover:text-white"}`}
                            >
                                NO
                            </button>
                        </div>

                        {/* Price Info */}
                        <div className="flex justify-between items-end mb-8">
                            <span className="text-sm text-text-secondary">Current Price</span>
                            <span className={`text-4xl font-mono font-bold ${selectedOutcome === "YES" ? "text-outcome-a" : "text-outcome-b"}`}>
                                $0.65
                            </span>
                        </div>

                        {/* Slider Action */}
                        <div className="mb-6">
                            <NeonSlider
                                side={selectedOutcome}
                                onConfirm={() => alert(`Order Placed: ${selectedOutcome}`)}
                            />
                        </div>

                        <p className="text-xs text-center text-text-secondary">
                            Slide to confirm your trade. 1% fee applies.
                        </p>
                    </GlassCard>

                    {/* Order Book */}
                    <div className="h-[400px]">
                        <OrderBook />
                    </div>

                </div>

            </main>
        </div>
    );
}
