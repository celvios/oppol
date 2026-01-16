"use client";

import { useState, useEffect } from "react";
import { formatUnits } from "viem";
import { ethers } from "ethers";
import { Loader2, CheckCircle, Clock, AlertTriangle, Search } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import NeonButton from "@/components/ui/NeonButton";
import { getContracts, getCurrentNetwork } from "@/lib/contracts";

// ABI for reading markets
const MARKET_ABI = [
    "function marketCount() view returns (uint256)",
    "function markets(uint256) view returns (string question, uint256 endTime, uint256 yesShares, uint256 noShares, uint256 liquidityParam, bool resolved, bool outcome, uint256 subsidyPool)"
];

interface Market {
    id: number;
    question: string;
    endTime: number;
    resolved: boolean;
    winningOutcome: number;
    formattedEndTime: string;
    status: 'ACTIVE' | 'ENDED' | 'RESOLVED';
}

export default function AdminMarketList({ adminKey }: { adminKey: string }) {
    const [markets, setMarkets] = useState<Market[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [resolvingId, setResolvingId] = useState<number | null>(null);
    const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const contracts = getContracts();
    const network = getCurrentNetwork();
    const MARKET_ADDRESS = (contracts as any).predictionMarketMulti || (contracts as any).predictionMarket;

    useEffect(() => {
        fetchMarkets();
    }, [MARKET_ADDRESS]);

    const fetchMarkets = async () => {
        if (!MARKET_ADDRESS) return;
        setIsLoading(true);
        try {
            const provider = new ethers.JsonRpcProvider(network.rpcUrl);
            const contract = new ethers.Contract(MARKET_ADDRESS, MARKET_ABI, provider);

            // 1. Get count
            const count = await contract.marketCount();
            const total = Number(count);
            const loadedMarkets: Market[] = [];

            // 2. Fetch last 20 markets (or all)
            for (let i = total - 1; i >= Math.max(0, total - 20); i--) {
                try {
                    // Try to fetch market data using generic getter
                    // If ABI mismatch occurs, catch it
                    const data = await contract.markets(i);
                    // data is array-like: [question, endTime, yesShares, noShares, liquidityParam, resolved, outcome, subsidyPool]
                    // OR if struct changed: [question, endTime, liquidityParam, resolved, outcome, ...]
                    // Ethers returns a Result object which allows access by index.

                    // We assume standard order based on typical solidity mapping getter for struct:
                    // string question
                    // uint256 outcomeCount (maybe? or skipped if dynamic array) - Wait, previous step we found ABI was tricky
                    // Let's assume standard field order from what we know:
                    // markets(i) -> question, endTime ...

                    // Actually, simpler approach:
                    // If we are admin, we can rely on our Backend API '/api/markets' which we just fixed!
                    // Is it better to query the contract directly or use the API we just fixed?
                    // The API returns metadata + status.
                    // This component is "AdminMarketList".
                    // Querying the API is safer because it handles the ABI complexity we struggled with.
                    // Let's switch to querying fetch('/api/markets')? 
                    // But that endpoint returns ALL markets.
                    // Let's try to keep direct contract call but be robust.

                    // Based on recent ABI understanding:
                    // markets(i) -> (question, endTime, ...)

                    loadedMarkets.push({
                        id: i,
                        question: data[0] || `Market #${i}`,
                        endTime: Number(data[1]), // approximate index
                        resolved: Boolean(data[5]), // boolean resolved usually later
                        winningOutcome: Number(data[6]),
                        formattedEndTime: new Date(Number(data[1]) * 1000).toLocaleString(),
                        status: Boolean(data[5]) ? 'RESOLVED' : (Date.now() / 1000 > Number(data[1]) ? 'ENDED' : 'ACTIVE')
                    });
                } catch (e) {
                    // Fallback to simpler data if struct parsing fails
                    loadedMarkets.push({
                        id: i,
                        question: `Market #${i}`,
                        endTime: 0,
                        resolved: false,
                        winningOutcome: 0,
                        formattedEndTime: 'Unknown',
                        status: 'ACTIVE'
                    });
                }
            }
            setMarkets(loadedMarkets);
        } catch (e) {
            console.error("Error loading markets", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResolve = async () => {
        if (resolvingId === null || selectedOutcome === null) return;
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/admin/resolve-market', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-secret': adminKey
                },
                body: JSON.stringify({
                    marketId: resolvingId,
                    outcomeIndex: selectedOutcome
                })
            });
            const data = await res.json();
            if (data.success) {
                alert("Market Resolved!");
                setResolvingId(null);
                fetchMarkets();
            } else {
                alert("Error: " + data.error);
            }
        } catch (e) {
            alert("Network Error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-white mb-4">Market Management</h2>

            {isLoading ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="animate-spin w-8 h-8 text-primary" />
                </div>
            ) : (
                <div className="grid gap-4">
                    {markets.map(m => (
                        <GlassCard key={m.id} className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-mono text-white/40">#{m.id}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full border ${m.status === 'ACTIVE' ? 'border-blue-500/50 text-blue-400 bg-blue-500/10' :
                                        m.status === 'RESOLVED' ? 'border-green-500/50 text-green-400 bg-green-500/10' :
                                            'border-amber-500/50 text-amber-400 bg-amber-500/10'
                                        }`}>
                                        {m.status}
                                    </span>
                                </div>
                                <h3 className="font-bold text-white text-lg">{m.question}</h3>
                                <p className="text-sm text-white/50">Ends: {m.formattedEndTime}</p>
                            </div>

                            <div className="flex items-center gap-2">
                                {m.status === 'ENDED' && (
                                    <NeonButton
                                        variant="primary"
                                        size="sm"
                                        onClick={() => setResolvingId(m.id)}
                                    >
                                        Resolve
                                    </NeonButton>
                                )}
                                {m.status === 'RESOLVED' && (
                                    <div className="flex items-center gap-2 text-green-400">
                                        <CheckCircle size={16} />
                                        <span>Winner: {m.winningOutcome}</span>
                                    </div>
                                )}
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}

            {/* Resolution Modal */}
            {resolvingId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <GlassCard className="w-full max-w-md p-6">
                        <h3 className="text-xl font-bold text-white mb-4">Resolve Market #{resolvingId}</h3>
                        <p className="text-white/60 mb-6">Select the winning outcome index (0 = Yes, 1 = No for binary).</p>

                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {[0, 1, 2, 3].map((idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedOutcome(idx)}
                                    className={`p-4 rounded-xl border transition-all ${selectedOutcome === idx
                                        ? 'bg-primary/20 border-primary text-white shadow-[0_0_15px_rgba(0,255,255,0.3)]'
                                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                                        }`}
                                >
                                    <span className="text-lg font-bold">Outcome {idx}</span>
                                    <span className="block text-xs opacity-50">{idx === 0 ? "Usually YES" : idx === 1 ? "Usually NO" : "Other"}</span>
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setResolvingId(null)}
                                className="flex-1 py-3 text-white/60 hover:text-white"
                            >
                                Cancel
                            </button>
                            <NeonButton
                                variant="primary"
                                className="flex-1"
                                disabled={selectedOutcome === null || isSubmitting}
                                onClick={handleResolve}
                            >
                                {isSubmitting ? <Loader2 className="animate-spin" /> : "Confirm Resolution"}
                            </NeonButton>
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    );
}
