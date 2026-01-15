"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, Legend } from 'recharts';
import { TrendingUp, Wallet, Clock, Activity } from "lucide-react";
import { useWallet } from "@/lib/use-wallet";
import { web3MultiService, MultiMarket } from '@/lib/web3-multi';
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import NeonSlider from "@/components/ui/NeonSlider";
import { SuccessModal } from "@/components/ui/SuccessModal";
import GlassCard from "@/components/ui/GlassCard";
import NeonButton from "@/components/ui/NeonButton";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { getMultiMarketMetadata } from "@/lib/market-metadata";

// Outcome colors for up to 10 outcomes
const OUTCOME_COLORS = [
    "#27E8A7", // Green
    "#FF2E63", // Red/Coral
    "#00F0FF", // Cyan
    "#FFB800", // Gold
    "#9D4EDD", // Purple
    "#FF6B35", // Orange
    "#3A86FF", // Blue
    "#FF006E", // Pink
    "#8338EC", // Violet
    "#FFFFFF", // White (fallback)
];

interface TradeSuccessData {
    marketId: number;
    outcome: string;
    outcomeIndex: number;
    shares: number;
    cost: string;
    question: string;
    newPrice: number;
    hash: string;
}

export function MultiOutcomeTerminal() {
    const [markets, setMarkets] = useState<MultiMarket[]>([]);
    const [selectedMarketId, setSelectedMarketId] = useState<number>(0);
    const [balance, setBalance] = useState<string>('0');
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);

    // Trade State
    const [selectedOutcome, setSelectedOutcome] = useState<number>(0);
    const [amount, setAmount] = useState('100');
    const [isTradeLoading, setIsTradeLoading] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successData, setSuccessData] = useState<TradeSuccessData | null>(null);

    const { isConnected, address, isLoading: walletLoading, connect } = useWallet();

    const market = markets.find(m => m.id === selectedMarketId) || markets[0];
    const marketRef = useRef(market);
    const metadata = market ? getMultiMarketMetadata(market.question, market.id) : null;

    useEffect(() => {
        marketRef.current = market;
    }, [market]);

    useEffect(() => {
        setMounted(true);
    }, []);

    // --- Data Fetching ---
    const fetchData = useCallback(async () => {
        if (!isConnected || !address) return;
        console.log('[MultiTerminal] fetchData called');
        try {
            const allMarkets = await web3MultiService.getMarkets();
            console.log('[MultiTerminal] Markets fetched:', allMarkets.length);
            setMarkets(allMarkets);
            try {
                const depositedBalance = await web3MultiService.getDepositedBalance(address);
                setBalance(depositedBalance);
            } catch (e) {
                console.error('[MultiTerminal] Balance fetch error:', e);
                setBalance('0');
            }
        } catch (error) {
            console.error('[MultiTerminal] Error in fetchData:', error);
        } finally {
            setLoading(false);
        }
    }, [isConnected, address]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isConnected) {
            fetchData();
            interval = setInterval(fetchData, 10000); // Refresh every 10s
        } else {
            setLoading(false);
        }
        return () => clearInterval(interval);
    }, [isConnected, address, fetchData]);

    useEffect(() => {
        if (markets.length > 0 && selectedMarketId === 0) {
            setSelectedMarketId(markets[0].id);
        }
    }, [markets, selectedMarketId]);

    // Reset selected outcome when market changes
    useEffect(() => {
        setSelectedOutcome(0);
    }, [selectedMarketId]);

    // --- Trading Logic ---
    const handleTrade = async () => {
        if (!amount || parseFloat(amount) <= 0 || !market) return;
        setIsTradeLoading(true);

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
            const response = await fetch(`${apiUrl}/api/multi-bet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: address,
                    marketId: market.id,
                    outcomeIndex: selectedOutcome,
                    amount: parseFloat(amount)
                })
            });

            const data = await response.json();
            if (data.success) {
                setSuccessData({
                    marketId: market.id,
                    outcome: market.outcomes[selectedOutcome],
                    outcomeIndex: selectedOutcome,
                    shares: data.transaction?.shares || 0,
                    cost: data.transaction?.cost || amount,
                    question: market.question,
                    newPrice: data.transaction?.newPrice || market.prices[selectedOutcome],
                    hash: data.transaction?.hash || '0x'
                });
                setIsSuccessModalOpen(true);
                fetchData();
            } else {
                alert(`Trade failed: ${data.error}`);
            }
        } catch (e: any) {
            console.error("Trade failed:", e);
            alert(`Trade failed: ${e.message}`);
        } finally {
            setIsTradeLoading(false);
        }
    };


    if (!mounted || walletLoading) {
        return <div className="p-10"><SkeletonLoader /></div>;
    }

    if (!isConnected && mounted) {
        return (
            <>
                <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-radial from-neon-cyan/5 to-transparent opacity-50" />
                    <GlassCard className="p-12 text-center max-w-md relative z-10 border-neon-cyan/30 shadow-[0_0_50px_rgba(0,240,255,0.1)]">
                        <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center animate-pulse-slow">
                            <Wallet className="w-10 h-10 text-neon-cyan" />
                        </div>
                        <h2 className="text-3xl font-heading font-bold text-white mb-4">Initialize Terminal</h2>
                        <p className="text-text-secondary mb-10 text-lg">Connect your wallet to access multi-outcome prediction markets.</p>
                        <NeonButton onClick={() => connect()} variant="cyan" className="w-full text-lg py-6">
                            ESTABLISH CONNECTION
                        </NeonButton>
                    </GlassCard>
                </div>
            </>
        );
    }

    if (loading || !market) return <div className="p-10"><SkeletonLoader /></div>;

    // Build chart data showing all outcome prices
    const chartData = market.prices.map((price, i) => ({
        name: market.outcomes[i],
        price: price,
        color: OUTCOME_COLORS[i % OUTCOME_COLORS.length]
    }));

    return (
        <div className="h-[calc(100vh-80px)] p-4 md:p-6 grid grid-cols-12 gap-6 max-w-[1800px] mx-auto">
            {successData && (
                <SuccessModal
                    isOpen={isSuccessModalOpen}
                    onClose={() => {
                        setIsSuccessModalOpen(false);
                        fetchData();
                    }}
                    data={{
                        marketId: successData.marketId,
                        side: successData.outcome,
                        shares: successData.shares,
                        cost: successData.cost,
                        question: successData.question,
                        newPrice: successData.newPrice,
                        hash: successData.hash
                    }}
                />
            )}

            {/* LEFT COLUMN: Market List (3 cols) */}
            <div className="col-span-12 lg:col-span-3 flex flex-col gap-4 h-full overflow-hidden">
                <GlassCard className="flex-none p-4 flex justify-between items-center bg-white/5">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse" />
                        <span className="font-mono text-sm tracking-widest text-white/70">MULTI-OUTCOME</span>
                    </div>
                    <span className="text-xs bg-white/10 px-2 py-1 rounded text-white/50">{markets.length} ACTIVE</span>
                </GlassCard>

                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {markets.map((m) => {
                        const topOutcome = m.outcomes[m.prices.indexOf(Math.max(...m.prices))];
                        const topPrice = Math.max(...m.prices);
                        return (
                            <motion.button
                                key={m.id}
                                onClick={() => setSelectedMarketId(m.id)}
                                className={`w-full text-left group relative p-4 rounded-xl border transition-all duration-300 ${selectedMarketId === m.id
                                    ? "bg-white/10 border-neon-green/50 shadow-[0_0_20px_rgba(39,232,167,0.1)]"
                                    : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20"
                                    }`}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className="flex gap-4 mb-3">
                                    {/* Market Image */}
                                    <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                        <img
                                            src={getMultiMarketMetadata(m.question, m.id).image}
                                            alt=""
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.parentElement?.classList.add('bg-neon-green/10');
                                            }}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start gap-2">
                                            <h3 className={`font-heading text-sm leading-snug line-clamp-2 ${selectedMarketId === m.id ? "text-white" : "text-white/70"}`}>
                                                {m.question}
                                            </h3>
                                            {selectedMarketId === m.id && (
                                                <div className="w-1.5 h-1.5 bg-neon-green rounded-full shadow-[0_0_10px_#27E8A7] flex-shrink-0 mt-1" />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between font-mono text-xs">
                                    <div className="flex gap-1 items-center">
                                        <span className="text-neon-cyan">{m.outcomeCount} outcomes</span>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <span className="text-neon-green">{topOutcome}: {topPrice.toFixed(0)}%</span>
                                    </div>
                                </div>

                                {/* Outcome mini-bars */}
                                <div className="flex gap-0.5 mt-3 h-1.5 rounded overflow-hidden">
                                    {m.prices.map((price, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                width: `${price}%`,
                                                backgroundColor: OUTCOME_COLORS[i % OUTCOME_COLORS.length],
                                                minWidth: '2px'
                                            }}
                                        />
                                    ))}
                                </div>
                            </motion.button>
                        );
                    })}
                </div>
            </div>

            {/* CENTER COLUMN: Chart & Info (6 cols) */}
            <div className="col-span-12 lg:col-span-6 flex flex-col gap-6 h-full">

                {/* Header Info */}
                <GlassCard className="p-6 relative overflow-hidden group">
                    {metadata && (
                        <div className="absolute top-0 right-0 h-full w-2/3 opacity-20 mask-image-linear-to-l pointer-events-none mix-blend-screen">
                            <img
                                src={metadata.image}
                                alt=""
                                className="h-full w-full object-cover object-center"
                            />
                            <div className="absolute inset-0 bg-gradient-to-l from-transparent to-surface" />
                        </div>
                    )}

                    <div className="relative z-10">
                        <div className="flex gap-2 mb-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono uppercase tracking-wider text-white/50">Market #{market.id}</span>
                            <span className="px-2 py-0.5 rounded bg-neon-green/20 text-[10px] font-mono uppercase tracking-wider text-neon-green">{market.outcomeCount} Outcomes</span>
                            <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono uppercase tracking-wider text-white/50">Ends {formatDistanceToNow(market.endTime * 1000)}</span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-heading font-bold text-white mb-2 max-w-2xl text-shadow-glow">
                            {market.question}
                        </h1>
                        {metadata && (
                            <p className="text-white/60 text-sm max-w-xl mb-4 leading-relaxed bg-black/20 p-2 rounded-lg backdrop-blur-sm border border-white/5">
                                {metadata.description}
                            </p>
                        )}

                        <div className="flex gap-8 items-end mt-4">
                            <div>
                                <div className="text-xs text-text-secondary uppercase tracking-widest mb-1">Leading</div>
                                <div className="text-3xl font-mono font-bold text-neon-green">
                                    {market.outcomes[market.prices.indexOf(Math.max(...market.prices))]}
                                </div>
                                <div className="text-lg font-mono text-neon-green/70">
                                    {Math.max(...market.prices).toFixed(1)}%
                                </div>
                            </div>

                            <div className="h-12 w-px bg-white/10" />

                            <div>
                                <div className="text-xs text-text-secondary uppercase tracking-widest mb-1">Volume</div>
                                <div className="text-xl font-mono text-white">${market.totalVolume}</div>
                            </div>

                            <div className="h-12 w-px bg-white/10" />

                            <div>
                                <div className="text-xs text-text-secondary uppercase tracking-widest mb-1">Liquidity</div>
                                <div className="text-xl font-mono text-white">${parseFloat(market.liquidityParam).toFixed(0)}</div>
                            </div>
                        </div>
                    </div>
                </GlassCard>

                {/* Outcome Probability Bars */}
                <GlassCard className="flex-1 min-h-[400px] p-6 flex flex-col relative overflow-hidden">
                    <div className="flex justify-between items-center mb-6 z-10 relative">
                        <h2 className="text-lg font-heading text-white">Outcome Probabilities</h2>
                        <span className="text-xs text-white/50 font-mono">Click to select</span>
                    </div>

                    <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-2">
                        {market.outcomes.map((outcome, i) => (
                            <motion.button
                                key={i}
                                onClick={() => setSelectedOutcome(i)}
                                className={`relative p-4 rounded-xl border transition-all text-left ${selectedOutcome === i
                                    ? 'border-white/30 bg-white/10'
                                    : 'border-white/5 bg-white/5 hover:bg-white/10'
                                    }`}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-4 h-4 rounded-full"
                                            style={{ backgroundColor: OUTCOME_COLORS[i % OUTCOME_COLORS.length] }}
                                        />
                                        <span className="font-heading text-white font-medium">{outcome}</span>
                                    </div>
                                    <span
                                        className="text-2xl font-mono font-bold"
                                        style={{ color: OUTCOME_COLORS[i % OUTCOME_COLORS.length] }}
                                    >
                                        {market.prices[i].toFixed(1)}%
                                    </span>
                                </div>

                                {/* Progress bar */}
                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full rounded-full"
                                        style={{ backgroundColor: OUTCOME_COLORS[i % OUTCOME_COLORS.length] }}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${market.prices[i]}%` }}
                                        transition={{ duration: 0.5, ease: "easeOut" }}
                                    />
                                </div>

                                {selectedOutcome === i && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_#fff]" />
                                    </div>
                                )}
                            </motion.button>
                        ))}
                    </div>
                </GlassCard>
            </div>

            {/* RIGHT COLUMN: Trading Panel (3 cols) */}
            <div className="col-span-12 lg:col-span-3 flex flex-col gap-4 h-full">
                <GlassCard className="flex-none p-4 bg-gradient-to-br from-white/5 to-transparent border-neon-cyan/20">
                    <div className="text-xs text-text-secondary uppercase tracking-widest mb-1">Available Balance</div>
                    <div className="text-2xl font-mono text-white flex items-center gap-2">
                        <span className="text-neon-cyan">$</span>
                        {parseFloat(balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        <NeonButton variant="glass" className="ml-auto text-xs py-1 h-auto" onClick={() => window.location.href = '/terminal/deposit'}>DEPOSIT</NeonButton>
                    </div>
                </GlassCard>

                <GlassCard className="flex-1 p-6 flex flex-col gap-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-green via-neon-cyan to-neon-coral opacity-50" />

                    <div>
                        <h3 className="text-lg font-heading font-bold text-white mb-4">Place Trade</h3>

                        {/* Selected Outcome Display */}
                        <div className="p-4 rounded-xl border border-white/10 bg-white/5 mb-4">
                            <div className="text-xs text-text-secondary uppercase tracking-widest mb-2">Selected Outcome</div>
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-4 h-4 rounded-full"
                                    style={{ backgroundColor: OUTCOME_COLORS[selectedOutcome % OUTCOME_COLORS.length] }}
                                />
                                <span className="font-heading text-white text-lg">{market.outcomes[selectedOutcome]}</span>
                                <span
                                    className="ml-auto font-mono text-xl font-bold"
                                    style={{ color: OUTCOME_COLORS[selectedOutcome % OUTCOME_COLORS.length] }}
                                >
                                    {market.prices[selectedOutcome].toFixed(1)}%
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-text-secondary uppercase tracking-widest mb-2 block">Amount (USDC)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-mono text-lg focus:outline-none focus:border-neon-cyan/50 focus:shadow-[0_0_20px_rgba(0,240,255,0.1)] transition-all"
                                        placeholder="0.00"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
                                        {['10', '50', '100'].map(val => (
                                            <button
                                                key={val}
                                                onClick={() => setAmount(val)}
                                                className="px-2 py-1 bg-white/10 rounded text-xs text-white/70 hover:bg-white/20 hover:text-white"
                                            >
                                                ${val}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-white/5 rounded-xl space-y-2 border border-white/5">
                                <div className="flex justify-between text-sm">
                                    <span className="text-text-secondary">Price</span>
                                    <span className="font-mono text-white">{market.prices[selectedOutcome].toFixed(1)}¢</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-text-secondary">Est. Shares</span>
                                    <span className="font-mono text-neon-cyan">
                                        {(() => {
                                            const amt = parseFloat(amount || '0');
                                            const price = market.prices[selectedOutcome] / 100;
                                            if (amt === 0 || price === 0) return '0';
                                            return `~${(amt / price).toFixed(0)}`;
                                        })()}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm border-t border-white/10 pt-2 mt-2">
                                    <span className="text-text-secondary">Max Spend</span>
                                    <span className="font-mono text-white">${parseFloat(amount || '0').toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto">
                        <NeonButton
                            onClick={handleTrade}
                            variant="cyan"
                            className="w-full py-4"
                            disabled={!amount || parseFloat(amount) <= 0 || parseFloat(balance) === 0 || isTradeLoading}
                        >
                            {isTradeLoading ? 'PROCESSING...' : `BUY ${market.outcomes[selectedOutcome].toUpperCase()}`}
                        </NeonButton>
                    </div>
                </GlassCard>

                {/* Outcome Distribution Mini-Vis */}
                <GlassCard className="flex-none p-4">
                    <h4 className="text-xs text-text-secondary uppercase tracking-widest mb-3">Probability Distribution</h4>
                    <div className="flex items-end gap-1 h-16">
                        {market.prices.map((price, i) => (
                            <div
                                key={i}
                                className="flex-1 rounded-t relative group overflow-hidden cursor-pointer"
                                style={{
                                    height: `${Math.max(price, 5)}%`,
                                    backgroundColor: `${OUTCOME_COLORS[i % OUTCOME_COLORS.length]}40`
                                }}
                                onClick={() => setSelectedOutcome(i)}
                            >
                                <div
                                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    style={{ backgroundColor: OUTCOME_COLORS[i % OUTCOME_COLORS.length] }}
                                />
                                {selectedOutcome === i && (
                                    <div
                                        className="absolute inset-0"
                                        style={{ backgroundColor: OUTCOME_COLORS[i % OUTCOME_COLORS.length] }}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-1 mt-2">
                        {market.outcomes.map((outcome, i) => (
                            <div key={i} className="flex-1 text-center">
                                <div className="text-[8px] text-white/40 truncate">{outcome}</div>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}
