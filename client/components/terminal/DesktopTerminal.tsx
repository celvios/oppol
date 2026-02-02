"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MultiOutcomeChart } from "./MultiOutcomeChart";
import { TrendingUp, Wallet, ArrowUpRight, ArrowDownRight, Clock, Activity, AlertCircle } from "lucide-react";
import { useWallet } from "@/lib/use-wallet";
import { LoginModal } from "@/components/ui/LoginModal";
import { web3Service } from '@/lib/web3';
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import NeonSlider from "@/components/ui/NeonSlider";
import { SuccessModal } from "@/components/ui/SuccessModal";
import { parseUnits } from 'viem';
import { getContracts } from '@/lib/contracts';
import GlassCard from "@/components/ui/GlassCard";
import NeonButton from "@/components/ui/NeonButton";
import { ResolutionPanel } from "@/components/ui/ResolutionPanel";
import { motion, AnimatePresence } from "framer-motion";
import { BalanceChecker } from "@/components/ui/BalanceChecker";
import { formatDistanceToNow } from "date-fns";

// Contract ABI
const MARKET_ABI = [
    { name: 'buyShares', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_marketId', type: 'uint256' }, { name: '_isYes', type: 'bool' }, { name: '_shares', type: 'uint256' }, { name: '_maxCost', type: 'uint256' }], outputs: [] },
] as const;

const contracts = getContracts() as any;
const MARKET_CONTRACT = (contracts.predictionMarket || '') as `0x${string}`;

interface Market {
    id: number;
    question: string;
    yesOdds: number;
    noOdds: number;
    yesShares: string;
    noShares: string;
    yesPool: string;
    noPool: string;
    totalVolume: string;
    endTime: number;
    resolved: boolean;
    outcome?: boolean;
    assertionPending?: boolean;
    assertedOutcome?: boolean;
    asserter?: string;
    isBoosted?: boolean;
}

import BoostButton from "@/components/market/BoostButton";

interface PricePoint {
    time: string;
    price: number;
}

interface TradeSuccessData {
    marketId: number;
    side: 'YES' | 'NO';
    shares: number;
    cost: string;
    question: string;
    newPrice: number;
    hash: string;
}

export function DesktopTerminal() {
    const [markets, setMarkets] = useState<Market[]>([]);
    const [selectedMarketId, setSelectedMarketId] = useState<number>(0);
    const [balance, setBalance] = useState<string>('0');
    const [loading, setLoading] = useState(true);
    const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
    const [mounted, setMounted] = useState(false);

    // Trade State
    const [tradeSide, setTradeSide] = useState<'YES' | 'NO'>('YES');
    const [amount, setAmount] = useState('100');
    const [isTradeLoading, setIsTradeLoading] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successData, setSuccessData] = useState<TradeSuccessData | null>(null);

    const { isConnected, address, isConnecting: walletLoading, connect } = useWallet();

    const market = markets.find(m => m.id === selectedMarketId) || markets[0];
    const marketRef = useRef(market);
    // Use API metadata - no fallback, API is source of truth
    const metadata = market ? {
        image: market.image_url || '',
        description: market.description || '',
        category: market.category_id || 'General'
    } : null;

    useEffect(() => {
        marketRef.current = market;
    }, [market]);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (market) {
            console.log('[DesktopTerminal] Debug Market:', {
                id: market.id,
                endTime: market.endTime,
                endTimeDate: new Date(market.endTime * 1000).toLocaleString(),
                now: Date.now() / 1000,
                isEnded: Date.now() / 1000 > market.endTime,
                resolved: market.resolved
            });
        }
    }, [market]);

    // --- Data Fetching ---

    const fetchHistory = useCallback(async (id: number) => {
        const generatePlaceholder = (price: number) => {
            const now = Date.now();
            return Array.from({ length: 50 }).map((_, i) => ({
                time: new Date(now - (49 - i) * 1000).toLocaleTimeString(),
                price: price + (Math.sin((now - (49 - i) * 1000) / 800) * 0.5)
            }));
        };

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL;
            if (apiUrl) {
                const response = await fetch(`${apiUrl}/api/markets/${id}/price-history?limit=50`);
                const data = await response.json();

                if (data.success && data.history?.length > 0) {
                    let history = data.history;
                    if (history.length < 50) {
                        const needed = 50 - history.length;
                        const firstPrice = history[0].price;
                        const now = Date.now();
                        const padding = Array.from({ length: needed }).map((_, i) => ({
                            time: '',
                            price: firstPrice + (Math.sin((now - (49 + needed - i) * 1000) / 800) * 0.5)
                        }));
                        history = [...padding, ...history];
                    }
                    setPriceHistory(history);
                } else {
                    setPriceHistory(generatePlaceholder(marketRef.current?.yesOdds || 50));
                }
            } else {
                setPriceHistory(generatePlaceholder(marketRef.current?.yesOdds || 50));
            }
        } catch (error) {
            console.error("Failed to fetch history:", error);
            setPriceHistory(generatePlaceholder(marketRef.current?.yesOdds || 50));
        }
    }, []);

    const fetchData = useCallback(async () => {
        // if (!isConnected || !address) return;
        console.log('[DesktopTerminal] fetchData called');
        try {
            const allMarkets = await web3Service.getMarkets();
            setMarkets(allMarkets);

            if (address) {
                try {
                    const depositedBalance = await web3Service.getDepositedBalance(address);
                    setBalance(depositedBalance);
                } catch (e) {
                    console.error('[DesktopTerminal] Balance fetch error:', e);
                    setBalance('0');
                }
            } else {
                setBalance('0');
            }
        } catch (error) {
            console.error('[DesktopTerminal] Error in fetchData:', error);
        } finally {
            setLoading(false);
        }
    }, [isConnected, address]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 60000); // Poll every 60s instead of 5s to reduce RPC usage
        return () => clearInterval(interval);
    }, [fetchData]);

    // --- Animation / Heartbeat Logic ---
    useEffect(() => {
        const interval = setInterval(() => {
            if (!marketRef.current) return;

            setPriceHistory(prev => {
                const now = Date.now();
                const timeString = new Date(now).toLocaleTimeString();
                const basePrice = marketRef.current?.yesOdds || 50;
                const waveOffset = Math.sin(now / 800) * 0.5;
                const animatedPrice = basePrice + waveOffset;

                const newPoint = {
                    time: timeString,
                    price: animatedPrice
                };

                if (prev.length === 0) {
                    return Array(50).fill(null).map((_, i) => ({
                        time: new Date(now - (49 - i) * 1000).toLocaleTimeString(),
                        price: basePrice + (Math.sin((now - (49 - i) * 1000) / 800) * 0.5)
                    }));
                }

                const newHistory = [...prev, newPoint];
                return newHistory.slice(-50);
            });
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (markets.length > 0 && selectedMarketId === 0) {
            setSelectedMarketId(markets[0].id);
        }
    }, [markets, selectedMarketId]);

    useEffect(() => {
        if (selectedMarketId) {
            fetchHistory(selectedMarketId);
        }
    }, [selectedMarketId, fetchHistory]);

    // --- Trading Logic ---

    const handleTrade = async () => {
        if (!isConnected) {
            connect();
            return;
        }
        if (!amount || parseFloat(amount) <= 0) return;
        setIsTradeLoading(true);

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
            const response = await fetch(`${apiUrl}/api/bet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: address,
                    marketId: market.id,
                    side: tradeSide,
                    amount: parseFloat(amount)
                })
            });

            const data = await response.json();
            if (data.success) {
                setSuccessData({
                    marketId: market.id,
                    side: tradeSide,
                    shares: data.transaction?.shares || 0,
                    cost: data.transaction?.cost || amount,
                    question: market.question,
                    newPrice: data.transaction?.newPrice || (tradeSide === 'YES' ? market.yesOdds : 100 - market.yesOdds),
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



    if (loading) return <div className="p-10"><SkeletonLoader /></div>;

    if (!market) {
        return (
            <div className="h-[calc(100vh-80px)] flex flex-col items-center justify-center text-white/50">
                <Activity size={64} className="mb-4 opacity-50" />
                <h2 className="text-2xl font-bold mb-2">No Active Markets</h2>
                <p>Check back later for new prediction markets.</p>
            </div>
        );
    }



    return (
        <div className="h-[calc(100vh-80px)] p-4 md:p-6 grid grid-cols-12 gap-6 max-w-[1800px]">
            <SuccessModal
                isOpen={isSuccessModalOpen}
                onClose={() => {
                    setIsSuccessModalOpen(false);
                    fetchData();
                }}
                data={successData || {
                    marketId: 0,
                    side: 'YES',
                    shares: 0,
                    cost: '0',
                    question: '',
                    newPrice: 0,
                    hash: ''
                }}
            />

            {/* LEFT COLUMN: Market List (3 cols) */}
            <div className="col-span-12 lg:col-span-3 flex flex-col gap-4 h-full overflow-hidden">
                <GlassCard className="flex-none p-4 flex flex-col gap-3 bg-white/5">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-neon-cyan rounded-full animate-pulse" />
                            <span className="font-mono text-sm tracking-widest text-white/70">LIVE MARKETS</span>
                        </div>
                        <span className="text-xs bg-white/10 px-2 py-1 rounded text-white/50">{markets.length} ACTIVE</span>
                    </div>
                    <a
                        href="/markets"
                        className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-neon-cyan border border-neon-cyan/20 hover:border-neon-cyan/50 transition-all"
                    >
                        <ArrowUpRight size={14} />
                        EXPLORE ALL MARKETS
                    </a>
                </GlassCard>

                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {markets.map((m) => (
                        <motion.button
                            key={m.id}
                            onClick={() => setSelectedMarketId(m.id)}
                            className={`w-full text-left group relative p-4 rounded-xl border transition-all duration-300 ${selectedMarketId === m.id
                                ? "bg-white/10 border-neon-cyan/50 shadow-[0_0_20px_rgba(0,240,255,0.1)]"
                                : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20"
                                }`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <div className="flex gap-4 mb-3">
                                {/* Market Image */}
                                <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                    <img
                                        src={m.image_url || ''}
                                        alt=""
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            e.currentTarget.parentElement?.classList.add('bg-neon-cyan/10');
                                        }}
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start gap-2">
                                        <h3 className={`font-heading text-sm leading-snug line-clamp-2 ${selectedMarketId === m.id ? "text-white" : "text-white/70"}`}>
                                            {m.question}
                                        </h3>
                                        {selectedMarketId === m.id && (
                                            <div className="w-1.5 h-1.5 bg-neon-cyan rounded-full shadow-[0_0_10px_#00F0FF] flex-shrink-0 mt-1" />
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between font-mono text-xs">
                                <div className="flex gap-3">
                                    <span className="text-outcome-a">{m.yesOdds.toFixed(0)}% YES</span>
                                    <span className="text-outcome-b">{m.noOdds.toFixed(0)}% NO</span>
                                </div>
                                <span className="text-white/30">${parseFloat(m.totalVolume).toLocaleString()}</span>
                            </div>
                        </motion.button>
                    ))}
                </div>
            </div>

            {/* CENTER COLUMN: Chart & Info (6 cols) */}
            <div className="col-span-12 lg:col-span-6 flex flex-col gap-6 h-full">

                {/* Header Info */}
                <GlassCard className="p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        {metadata ? (
                            <img
                                src={metadata.image}
                                alt="market"
                                className="w-[300px] h-[300px] object-cover rounded-full blur-[60px] opacity-100"
                            />
                        ) : (
                            <Activity size={100} />
                        )}
                    </div>
                    {/* Background Image for premium feel */}
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
                        <div className="flex gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono uppercase tracking-wider text-white/50">Market #{market.id}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${Date.now() > market.endTime * 1000
                                ? 'bg-orange-500/20 text-orange-400'
                                : 'bg-white/10 text-white/50'
                                }`}>
                                {Date.now() > market.endTime * 1000
                                    ? `Ended ${formatDistanceToNow(market.endTime * 1000)} ago`
                                    : `Ends in ${formatDistanceToNow(market.endTime * 1000)}`
                                }
                            </span>
                            <div className="ml-auto">
                                <BoostButton marketId={market.id} isBoosted={market.isBoosted} compact />
                            </div>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-heading font-bold text-white mb-2 max-w-2xl text-shadow-glow">
                            {market.question}
                        </h1>
                        {metadata && (
                            <p className="text-white/60 text-sm max-w-xl mb-6 leading-relaxed bg-black/20 p-2 rounded-lg backdrop-blur-sm border border-white/5">
                                {metadata.description}
                            </p>
                        )}

                        <div className="flex gap-8 items-end mt-4">
                            <div>
                                <div className="text-sm text-text-secondary uppercase tracking-widest mb-1">Chance</div>
                                <div className="text-6xl font-mono font-bold tracking-tighter text-white">
                                    {market.yesOdds.toFixed(1)}%
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
                                <div className="text-xl font-mono text-white">${parseFloat((market as any).liquidityParam || '0').toFixed(0)}</div>
                            </div>
                        </div>
                    </div>
                </GlassCard>

                {/* Chart Container */}
                <GlassCard className="flex-1 min-h-[400px] p-6 flex flex-col relative overflow-hidden">
                    <div className="flex justify-between items-center mb-6 z-10 relative">
                        <h2 className="text-lg font-heading text-white">Chance Wave</h2>
                        {/* Optional filters can go here */}
                    </div>

                    <div className="flex-1 w-full h-full min-h-[300px]">
                        <MultiOutcomeChart
                            data={priceHistory}
                            outcomes={market.outcomes || ["YES", "NO"]}
                        />
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
                        <NeonButton variant="glass" className="ml-auto text-xs py-1 h-auto" onClick={() => window.location.href = '/deposit'}>DEPOSIT</NeonButton>
                    </div>
                </GlassCard>

                <GlassCard className="flex-1 p-6 flex flex-col gap-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-green via-neon-cyan to-neon-coral opacity-50" />

                    <div>
                        <h3 className="text-lg font-heading font-bold text-white mb-4">Execute Trade</h3>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <button
                                onClick={() => setTradeSide('YES')}
                                className={`py-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${tradeSide === 'YES'
                                    ? 'bg-outcome-a/10 border-outcome-a shadow-[0_0_20px_rgba(74,222,128,0.2)]'
                                    : 'bg-white/5 border-white/5 opacity-50 hover:opacity-100'
                                    }`}
                            >
                                <span className={`text-xl font-bold ${tradeSide === 'YES' ? 'text-outcome-a' : 'text-white'}`}>YES</span>
                                <span className="text-xs font-mono text-white/50">BUY</span>
                            </button>
                            <button
                                onClick={() => setTradeSide('NO')}
                                className={`py-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${tradeSide === 'NO'
                                    ? 'bg-outcome-b/10 border-outcome-b shadow-[0_0_20px_rgba(248,113,113,0.2)]'
                                    : 'bg-white/5 border-white/5 opacity-50 hover:opacity-100'
                                    }`}
                            >
                                <span className={`text-xl font-bold ${tradeSide === 'NO' ? 'text-outcome-b' : 'text-white'}`}>NO</span>
                                <span className="text-xs font-mono text-white/50">BUY</span>
                            </button>
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
                                    <span className="font-mono text-white">{(tradeSide === 'YES' ? market.yesOdds : 100 - market.yesOdds).toFixed(1)}c</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-text-secondary">Est. Shares</span>
                                    <span className="font-mono text-neon-cyan">
                                        {(() => {
                                            const amt = parseFloat(amount || '0');
                                            const price = (tradeSide === 'YES' ? market.yesOdds : 100 - market.yesOdds) / 100;
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

                    {/* Market Resolution or Trade Form */}
                    {((Date.now() / 1000) > (market.endTime || 0) || market.resolved || market.assertionPending) ? (
                        <div className="flex-none p-6 bg-white/5 border-t border-white/5">
                            <ResolutionPanel
                                marketId={market.id}
                                question={market.question}
                                endTime={market.endTime}
                                resolved={market.resolved}
                                outcome={market.outcome}
                                winningOutcomeIndex={market.winningOutcome}
                                assertionPending={market.assertionPending}
                                assertedOutcome={market.assertedOutcome}
                                assertedOutcomeIndex={market.assertedOutcome}
                                asserter={market.asserter}
                            />
                        </div>
                    ) : (
                        <div className="mt-auto">
                            {!isConnected ? (
                                <NeonButton onClick={() => connect()} variant="cyan" className="w-full text-lg py-4">
                                    CONNECT TO TRADE
                                </NeonButton>
                            ) : (
                                <NeonSlider
                                    side={tradeSide}
                                    onConfirm={handleTrade}
                                    isLoading={isTradeLoading}
                                    disabled={!amount || parseFloat(amount) <= 0 || parseFloat(balance) === 0}
                                />
                            )}
                        </div>
                    )}
                </GlassCard>

                {/* Market Depth Mini-Vis (Optional) */}
                <GlassCard className="flex-none p-4">
                    <h4 className="text-xs text-text-secondary uppercase tracking-widest mb-3">Order Book Depth</h4>
                    <div className="flex items-end gap-1 h-16">
                        <div className="flex-1 bg-outcome-a/20 rounded-t relative group overflow-hidden" style={{ height: `${market.yesOdds}%` }}>
                            <div className="absolute inset-0 bg-outcome-a/30 transform translate-y-full group-hover:translate-y-0 transition-transform" />
                        </div>
                        <div className="flex-1 bg-outcome-b/20 rounded-t relative group overflow-hidden" style={{ height: `${market.noOdds}%` }}>
                            <div className="absolute inset-0 bg-outcome-b/30 transform translate-y-full group-hover:translate-y-0 transition-transform" />
                        </div>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}
