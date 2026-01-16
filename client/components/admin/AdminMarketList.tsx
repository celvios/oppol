import { useState, useEffect } from "react";
import { Loader2, CheckCircle, Clock, AlertTriangle, Search } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import NeonButton from "@/components/ui/NeonButton";

interface Market {
    id: number;
    question: string;
    endTime: number;
    resolved: boolean;
    winningOutcome: number;
    formattedEndTime: string;
    status: 'ACTIVE' | 'ENDED' | 'RESOLVED';
    volume?: string;
    image?: string;
}

export default function AdminMarketList({ adminKey }: { adminKey: string }) {
    const [markets, setMarkets] = useState<Market[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [resolvingId, setResolvingId] = useState<number | null>(null);
    const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchMarkets();
    }, []);

    const fetchMarkets = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/markets');
            const data = await res.json();

            if (data.success) {
                const loadedMarkets: Market[] = data.markets.map((m: any) => ({
                    id: m.market_id,
                    question: m.question,
                    endTime: m.endTime,
                    resolved: m.resolved,
                    winningOutcome: 0, // Not needed for list display, detailed view handles it
                    formattedEndTime: new Date(m.endTime * 1000).toLocaleString(),
                    status: m.resolved ? 'RESOLVED' : (Date.now() / 1000 > m.endTime ? 'ENDED' : 'ACTIVE'),
                    volume: m.volume,
                    image: m.image
                }));
                // Sort by ID desc (newest first)
                loadedMarkets.sort((a, b) => b.id - a.id);
                setMarkets(loadedMarkets);
            }
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
