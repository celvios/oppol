import { useState, useEffect } from "react";
import { Loader2, CheckCircle, Clock, AlertTriangle, Search, Trash2 } from "lucide-react";
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
    outcomes: string[];
    isHidden: boolean;
}

export default function AdminMarketList({ adminKey }: { adminKey: string }) {
    const [markets, setMarkets] = useState<Market[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [resolvingId, setResolvingId] = useState<number | null>(null);
    const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [dbStats, setDbStats] = useState<{ count: number, error: string | null }>({ count: -1, error: null });

    useEffect(() => {
        fetchMarkets();
    }, []);

    const fetchMarkets = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/markets', {
                headers: {
                    'x-admin-secret': adminKey
                }
            });
            const data = await res.json();

            setDbStats({
                count: data.dbCount !== undefined ? data.dbCount : -1,
                error: data.dbError || null,
                ids: data.dbIds || []
            } as any);

            if (data.success) {
                const loadedMarkets: Market[] = data.markets.map((m: any) => ({
                    id: m.market_id,
                    question: m.question,
                    endTime: m.endTime,
                    resolved: m.resolved,
                    winningOutcome: 0, // Not needed for list display, detailed view handles it
                    formattedEndTime: new Date(m.endTime * 1000).toLocaleString(),
                    status: m.isHidden ? 'DELETED' : (m.resolved ? 'RESOLVED' : (Date.now() / 1000 > m.endTime ? 'ENDED' : 'ACTIVE')),
                    volume: m.volume,
                    image: m.image,
                    outcomes: m.outcomes || ["YES", "NO"], // Fallback
                    isHidden: m.isHidden
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

    const handleDelete = async (id: number) => {
        if (!confirm(`Are you sure you want to delete Market #${id}? This will remove it from the app (DB) but it remains on-chain.`)) {
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/admin/delete-market', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-secret': adminKey
                },
                body: JSON.stringify({ marketId: id })
            });

            // Handle 404 cleanly (already deleted)
            if (res.status === 404) {
                setMarkets(prev => prev.map(m => m.id === id ? { ...m, isHidden: true, status: 'DELETED' } : m));
                alert("Market was already deleted.");
                return;
            }

            const data = await res.json();
            if (data.success) {
                // Update local state to mark as deleted instead of removing
                setMarkets(prev => prev.map(m => m.id === id ? { ...m, isHidden: true, status: 'DELETED' } : m));
                alert("Market Deleted from DB");
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
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">Market Management</h2>
                <div className="flex flex-col items-end">
                    <div className="text-xs font-mono text-white/30 flex gap-2">
                        <span title="Total DB Rows">DB Rows: {dbStats.count}</span>
                        {dbStats.error && <span className="text-red-400">Error: {dbStats.error}</span>}
                    </div>
                    {/* Debug List */}
                    {dbStats.count > 0 && (
                        <div className="text-[10px] text-white/20 max-w-[200px] text-right truncate">
                            IDs: {(dbStats as any).ids?.join(', ')}
                        </div>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="animate-spin w-8 h-8 text-primary" />
                </div>
            ) : (
                <div className="grid gap-4">
                    {markets.map(m => (
                        <GlassCard key={m.id} className={`p-4 flex flex-col md:flex-row justify-between items-center gap-4 ${m.isHidden ? 'opacity-50 grayscale' : ''}`}>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-mono text-white/40">#{m.id}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full border ${m.status === 'DELETED' ? 'border-red-500/50 text-red-400 bg-red-500/10' :
                                        m.status === 'ACTIVE' ? 'border-blue-500/50 text-blue-400 bg-blue-500/10' :
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
                                {!m.isHidden && (
                                    <button
                                        onClick={() => handleDelete(m.id)}
                                        className="p-2 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors mr-2"
                                        title="Delete from DB"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}

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
                            {markets.find(m => m.id === resolvingId)?.outcomes?.map((outcome, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedOutcome(idx)}
                                    className={`p-4 rounded-xl border transition-all ${selectedOutcome === idx
                                        ? 'bg-primary/20 border-primary text-white shadow-[0_0_15px_rgba(0,255,255,0.3)]'
                                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                                        }`}
                                >
                                    <span className="text-lg font-bold">{outcome}</span>
                                    <span className="block text-xs opacity-50">Index {idx}</span>
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
