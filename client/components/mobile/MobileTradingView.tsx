"use client";

import { useState, Suspense, useEffect } from "react";
import { TrendingUp, Users, Clock, Loader2 } from "lucide-react";
import ProbabilityChart from "@/components/trade/ProbabilityChart";
import OrderBook from "@/components/trade/OrderBook";
import NeonSlider from "@/components/ui/NeonSlider";
import { useWallet } from "@/lib/use-wallet";
import { web3MultiService, MultiMarket } from '@/lib/web3-multi';
import { formatDistanceToNow } from "date-fns";

interface MobileTradingViewProps {
    outcome: "YES" | "NO";
    setOutcome: (o: "YES" | "NO") => void;
    marketId?: number;
    question?: string;
}

export default function MobileTradingView({ outcome, setOutcome, marketId, question }: MobileTradingViewProps) {
    const [activeTab, setActiveTab] = useState<"CHART" | "BOOK">("CHART");
    const [amount, setAmount] = useState('10');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [market, setMarket] = useState<MultiMarket | null>(null);
    const [loading, setLoading] = useState(true);

    const { address } = useWallet();

    useEffect(() => {
        const fetchMarket = async () => {
            if (!marketId) return;
            try {
                const markets = await web3MultiService.getMarkets();
                const found = markets.find(m => m.id === marketId);
                if (found) {
                    setMarket(found);
                }
            } catch (e) {
                console.error('Failed to fetch market:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchMarket();
    }, [marketId]);

    const handleTrade = async () => {
        if (!amount || parseFloat(amount) <= 0 || !address || !market) return;

        setIsLoading(true);
        setStatus('idle');
        setErrorMessage('');

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
            const response = await fetch(`${apiUrl}/api/bet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: address,
                    marketId: market.id,
                    side: outcome,
                    shares: parseFloat(amount) / 0.5,
                    amount: parseFloat(amount)
                })
            });

            const data = await response.json();

            if (data.success) {
                setStatus('success');
            } else {
                setStatus('error');
                setErrorMessage(data.error || 'Trade failed');
            }
        } catch (e: any) {
            console.error("Trade API error:", e);
            setStatus('error');
            setErrorMessage(e.message || 'Network error');
        } finally {
            setIsLoading(false);
        }
    };

    if (loading || !market) {
        return (
            <div className="flex flex-col min-h-[calc(100vh-80px)] md:hidden pb-32 items-center justify-center">
                <Loader2 className="animate-spin text-neon-cyan" size={32} />
            </div>
        );
    }

    const isResolved = market.resolved;
    const hasEnded = Date.now() / 1000 >= market.endTime;

    return (
        <div className="flex flex-col min-h-[calc(100vh-80px)] md:hidden pb-32">
            {/* Header Stats */}
            <div className="px-6 pt-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-text-secondary">
                        {market.category_id || 'MARKET'}
                    </span>
                    {!hasEnded && !isResolved && (
                        <span className="flex items-center gap-1 text-[10px] text-outcome-a font-mono ml-auto">
                            <span className="relative flex h-1.5 w-1.5 mr-1">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-outcome-a opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-outcome-a"></span>
                            </span>
                            LIVE
                        </span>
                    )}
                    {isResolved && (
                        <span className="px-2 py-0.5 rounded bg-green-500/20 text-[10px] font-mono text-green-400 ml-auto">
                            RESOLVED
                        </span>
                    )}
                    {hasEnded && !isResolved && (
                        <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-[10px] font-mono text-yellow-400 ml-auto">
                            ENDED
                        </span>
                    )}
                </div>

                {/* Market Image */}
                <div className="relative w-full h-48 mb-4 rounded-xl overflow-hidden border border-white/10 bg-black/40">
                    {(() => {
                        let img = market.image_url || market.image || '';
                        const desc = market.description || '';
                        const isValid = (s: string) => s.startsWith('http') || s.startsWith('data:') || s.startsWith('/');
                        if (!isValid(img) && isValid(desc)) {
                            img = desc;
                        }

                        if (img && isValid(img)) {
                            return (
                                <img
                                    src={img}
                                    alt={market.question}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                            );
                        }
                        return (
                            <div className="w-full h-full flex items-center justify-center">
                                <TrendingUp className="w-8 h-8 text-white/20" />
                            </div>
                        );
                    })()}
                    <div className="absolute inset-0 bg-gradient-to-t from-void/90 via-void/40 to-transparent" />
                </div>

                <h1 className="text-2xl font-heading font-bold leading-tight mb-4">
                    {market.question}
                </h1>
                <div className="flex gap-4 text-xs text-text-secondary border-b border-white/10 pb-4">
                    <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> ${market.totalVolume}</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {market.outcomeCount} outcomes</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDistanceToNow(market.endTime * 1000)}</span>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex px-6 mb-4">
                <button
                    onClick={() => setActiveTab("CHART")}
                    className={`flex-1 pb-2 text-sm font-bold border-b-2 transition-colors ${activeTab === "CHART" ? "border-neon-cyan text-neon-cyan" : "border-transparent text-text-secondary"}`}
                >
                    Chart
                </button>
                <button
                    onClick={() => setActiveTab("BOOK")}
                    className={`flex-1 pb-2 text-sm font-bold border-b-2 transition-colors ${activeTab === "BOOK" ? "border-neon-cyan text-neon-cyan" : "border-transparent text-text-secondary"}`}
                >
                    Order Book
                </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 px-4 mb-4">
                {activeTab === "CHART" ? (
                    <div className="h-[300px]">
                        <ProbabilityChart outcome={outcome} marketId={marketId} />
                    </div>
                ) : (
                    <div className="h-[400px]">
                        <OrderBook />
                    </div>
                )}
            </div>

            {/* Resolution Status */}
            {(isResolved || hasEnded) && (
                <div className="px-6 mb-4">
                    <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                        <div className="text-xs text-text-secondary uppercase tracking-widest mb-2">
                            {isResolved ? 'Resolution Status' : 'Market Status'}
                        </div>
                        <div className="text-lg font-heading text-white">
                            {isResolved ? `Resolved: ${market.outcomes[market.winningOutcome]}` : 'Market Ended - Awaiting Resolution'}
                        </div>
                    </div>
                </div>
            )}

            {/* Sticky Action Footer - Only show if market is active */}
            {!hasEnded && !isResolved && (
                <div className="fixed bottom-20 left-0 right-0 p-4 bg-void/90 backdrop-blur-xl border-t border-white/10 z-40">
                    {status === 'success' && (
                        <div className="mb-2 p-2 bg-green-500/10 border border-green-500/20 rounded flex items-center justify-center gap-2">
                            <span>✅</span> <span className="text-xs text-green-200">Trade Successful!</span>
                        </div>
                    )}
                    {status === 'error' && (
                        <div className="mb-2 p-2 bg-red-500/10 border border-red-500/20 rounded flex items-center justify-center gap-2">
                            <span>❌</span> <span className="text-xs text-red-200">{errorMessage}</span>
                        </div>
                    )}

                    <div className="flex justify-between items-center mb-4 px-2">
                        <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                                <label className="text-[10px] text-text-secondary uppercase">Amount</label>
                                <div className="flex items-center">
                                    <span className="text-white font-mono">$</span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="bg-transparent w-20 text-white font-mono font-bold focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 bg-white/5 p-1 rounded-lg">
                            <button
                                onClick={() => setOutcome("YES")}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${outcome === "YES" ? "bg-outcome-a text-void" : "text-text-secondary"}`}
                            >
                                YES
                            </button>
                            <button
                                onClick={() => setOutcome("NO")}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${outcome === "NO" ? "bg-outcome-b text-void" : "text-text-secondary"}`}
                            >
                                NO
                            </button>
                        </div>
                    </div>

                    <Suspense fallback={<div className="h-12 bg-white/5 rounded-lg animate-pulse" />}>
                        <NeonSlider
                            side={outcome}
                            onConfirm={handleTrade}
                            isLoading={isLoading}
                            disabled={!address || !amount || isLoading}
                        />
                    </Suspense>
                </div>
            )}
        </div>
    );
}
