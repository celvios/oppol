"use client";

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { TrendingUp, Wallet, ArrowDown, X, Activity, DollarSign, BarChart2 } from "lucide-react";
import { ReownConnectButton } from "@/components/ui/ReownConnectButtonLite";
import { web3Service, Market } from '@/lib/web3';
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/lib/store";
import { useWallet } from "@/lib/use-wallet";
import { getMarketMetadata } from "@/lib/market-metadata";
import { AnimatePresence, motion } from "framer-motion";

// Lazy load heavy components
const AreaChart = lazy(() => import('recharts').then(m => ({ default: m.AreaChart })));
const Area = lazy(() => import('recharts').then(m => ({ default: m.Area })));
const XAxis = lazy(() => import('recharts').then(m => ({ default: m.XAxis })));
const YAxis = lazy(() => import('recharts').then(m => ({ default: m.YAxis })));
const ResponsiveContainer = lazy(() => import('recharts').then(m => ({ default: m.ResponsiveContainer })));
const CartesianGrid = lazy(() => import('recharts').then(m => ({ default: m.CartesianGrid })));
const Tooltip = lazy(() => import('recharts').then(m => ({ default: m.Tooltip })));
const NeonSlider = lazy(() => import("@/components/ui/NeonSlider"));
const SuccessModal = lazy(() => import("@/components/ui/SuccessModal").then(m => ({ default: m.SuccessModal })));
const GlassCard = lazy(() => import("@/components/ui/GlassCard"));
const ResolutionPanel = lazy(() => import("@/components/ui/ResolutionPanel").then(m => ({ default: m.ResolutionPanel })));

// Contract ABI
const MARKET_ABI = [
    {
        name: 'buyShares',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: '_marketId', type: 'uint256' },
            { name: '_isYes', type: 'bool' },
            { name: '_shares', type: 'uint256' },
            { name: '_maxCost', type: 'uint256' }
        ],
        outputs: [],
    },
] as const;

// Move getContracts call inside component to avoid SSR issues
const getMarketContract = () => {
    try {
        const { getContracts } = require('@/lib/contracts');
        const contracts = getContracts() as any;
        return (contracts.predictionMarket || '0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6') as `0x${string}`;
    } catch (e) {
        return '0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6' as `0x${string}`;
    }
};

// Outcome colors for multi-outcome markets
const OUTCOME_COLORS = [
    "#27E8A7", // Green
    "#FF2E63", // Red/Coral
    "#00F0FF", // Cyan
    "#FFB800", // Gold
    "#9D4EDD", // Purple
    "#FF6B35", // Orange
];

interface TradeSuccessData {
    marketId: number;
    side: string; // Changed from 'YES' | 'NO' to support multi-outcome names
    shares: number;
    cost: string;
    question: string;
    newPrice: number;
    hash: string;
}

import { useSearchParams } from "next/navigation";

export function MobileTerminal() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
    const [showWalletModal, setShowWalletModal] = useState(false);
    const [selectedMarketId, setSelectedMarketId] = useState<number>(0);
    const [errorInfo, setErrorInfo] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const copyAddress = () => {
        if (address) {
            navigator.clipboard.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    useEffect(() => {
        const urlId = Number(searchParams.get('marketId'));
        if (urlId && !isNaN(urlId)) {
            setSelectedMarketId(urlId);
        }
    }, [searchParams]);

    const [markets, setMarkets] = useState<Market[]>([
        // Mock market data for immediate display
        {
            id: 0,
            question: "Will Bitcoin reach $100,000 by end of 2024?",
            outcomes: ["YES", "NO"],
            outcomeCount: 2,
            shares: ["1000", "1000"],
            prices: [65, 35],
            endTime: Date.now() / 1000 + 86400,
            liquidityParam: "5000",
            totalVolume: "12500",
            resolved: false,
            winningOutcome: 0,
            yesOdds: 65,
            noOdds: 35,
            yesShares: "1000",
            noShares: "1000",
            yesPool: "1000",
            noPool: "1000"
        }
    ]);
    const [balance, setBalance] = useState<string>('0');
    const [loading, setLoading] = useState(false); // Start with false to show cached data
    const [marketError, setMarketError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const [isLoadingReal, setIsLoadingReal] = useState(true); // Track real data loading
    const [priceHistory, setPriceHistory] = useState<{ time: string, price: number }[]>([]);
    const [chartView, setChartView] = useState<'YES' | 'NO'>('YES');
    const [isTradeSheetOpen, setIsTradeSheetOpen] = useState(false);
    const [tradeSide, setTradeSide] = useState<string>('YES'); // Changed to string to support multi-outcome names
    const [selectedOutcomeIndex, setSelectedOutcomeIndex] = useState<number>(0);

    const { isConnected, address, isConnecting, disconnect, connect } = useWallet();
    const MARKET_CONTRACT = getMarketContract();
    const { setTradeModalOpen } = useUIStore();

    const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    const handleLogout = () => {
        localStorage.clear();
        disconnect();
        router.push('/');
        setIsHeaderMenuOpen(false);
    };

    // Toggle Menu Visibility based on Trade Sheet
    useEffect(() => {
        setTradeModalOpen(isTradeSheetOpen);
    }, [isTradeSheetOpen, setTradeModalOpen]);

    const market = markets.find(m => m.id === selectedMarketId) || markets[0];
    const marketRef = useRef(market);
    const metadata = market ? getMarketMetadata(market.question, market.id) : null;

    useEffect(() => {
        marketRef.current = market;
    }, [market]);

    // Simplified animation - only update every 5 seconds to reduce CPU usage
    useEffect(() => {
        const interval = setInterval(() => {
            if (!marketRef.current) return;

            const basePrice = marketRef.current?.yesOdds || 50;
            const now = Date.now();
            const timeString = new Date(now).toLocaleTimeString();

            setPriceHistory(prev => {
                const newPoint = { time: timeString, price: basePrice };
                const newHistory = prev.length > 0 ? [...prev, newPoint] : [newPoint];
                return newHistory.slice(-10); // Keep only 10 points instead of 50
            });
        }, 5000); // Update every 5 seconds instead of 1

        return () => clearInterval(interval);
    }, []);

    const chartData = (priceHistory.length > 0 ? priceHistory : [{ time: 'Now', price: market?.yesOdds || 50 }])
        .map(point => ({
            time: point.time,
            yesPrice: point.price,
            noPrice: 100 - point.price
        }));

    // Data Fetching
    useEffect(() => {
        async function fetchPriceHistory() {
            if (!selectedMarketId) return;
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL;
                if (apiUrl) {
                    const response = await fetch(`${apiUrl}/api/markets/${selectedMarketId}/price-history?limit=50`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.history?.length > 0) {
                            setPriceHistory(data.history);
                        } else {
                            // Fallback will be handled by animation loop if empty
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to fetch price history", error);
            }
        }

        fetchPriceHistory();
        // Removed interval to avoid overwriting animation
    }, [selectedMarketId]);

    // NEW: Load markets and set initial selection
    useEffect(() => {
        const fetchMarkets = async () => {
            try {
                const data = await web3Service.getMarkets();
                setMarkets(data);
            } catch (error) {
                console.error("Failed to fetch markets:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchMarkets();
    }, []); // Run once on mount

    // Set initial market selection
    useEffect(() => {
        if (selectedMarketId === 0 && markets.length > 0) {
            const urlId = Number(searchParams.get('marketId'));
            if (urlId && markets.find(m => m.id === urlId)) {
                setSelectedMarketId(urlId);
            } else {
                setSelectedMarketId(markets[0].id);
            }
        }
    }, [markets, selectedMarketId, searchParams]);

    const fetchData = useCallback(async () => {
        // if (!isConnected || !address) return; // Allow fetching for visitors

        setMarketError(null);
        setIsLoadingReal(true);

        try {
            // Parallel requests for faster loading
            const [allMarkets, depositedBalance] = await Promise.all([
                web3Service.getMarkets(),
                address ? web3Service.getDepositedBalance(address).catch(() => '0') : Promise.resolve('0')
            ]);

            if (allMarkets.length === 0) {
                throw new Error('No markets available');
            }

            setMarkets(allMarkets);
            setBalance(depositedBalance);
            setRetryCount(0);
        } catch (error: any) {
            console.error('[MobileTerminal] Error:', error);
            setMarketError(error.message || 'Failed to load markets');

            if (retryCount < 2) { // Reduce retries to 2
                setTimeout(() => setRetryCount(prev => prev + 1), 1000); // Faster retry
            }
        } finally {
            setIsLoadingReal(false);
        }
    }, [isConnected, address, retryCount]);

    useEffect(() => {
        if (!isConnected) {
            setLoading(false);
            setIsLoadingReal(false);
            return;
        }
        fetchData();
        const interval = setInterval(fetchData, 30000); // Reduce polling frequency
        return () => clearInterval(interval);
    }, [isConnected, address, fetchData]);

    // Trigger retry when retryCount changes
    useEffect(() => {
        if (retryCount > 0 && isConnected && address) {
            fetchData();
        }
    }, [retryCount, isConnected, address, fetchData]);

    if (errorInfo) {
        return (
            <div className="p-6 text-white">
                <h2 className="text-xl font-bold mb-4">Error</h2>
                <p className="text-red-500 font-mono text-sm">{errorInfo}</p>
            </div>
        );
    }

    if (!mounted) {
        return <div className="p-6"><SkeletonLoader /></div>;
    }



    if (loading) return <div className="p-6"><SkeletonLoader /></div>;

    if (marketError && markets.length === 0) {
        return (
            <div className="p-6 text-white flex flex-col items-center justify-center h-[80vh]">
                <div className="text-center max-w-md">
                    <div className="text-red-400 text-lg font-bold mb-2">Connection Error</div>
                    <div className="text-white/70 text-sm mb-4">{marketError}</div>
                    <div className="text-white/50 text-xs mb-6">
                        {retryCount < 3 ? `Retrying... (${retryCount}/3)` : 'Max retries reached'}
                    </div>
                    <button
                        onClick={() => setRetryCount(prev => prev + 1)}
                        disabled={retryCount >= 3}
                        className="px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg disabled:opacity-50"
                    >
                        Retry Now
                    </button>
                </div>
            </div>
        );
    }

    if (!market) return <div className="p-6 text-white/50 flex items-center justify-center h-[80vh] font-mono">[SYSTEM: NO MARKETS]</div>;

    const currentPrice = chartView === 'YES' ? market.yesOdds : (100 - market.yesOdds);
    const priceColor = chartView === 'YES' ? "#27E8A7" : "#FF2E63";

    return (
        <div className="pb-12 relative min-h-screen">

            {/* 1. Header */}
            <header className="px-4 py-4 pt-6 sticky top-0 z-30 bg-void/80 backdrop-blur-xl border-b border-white/5 flex justify-end items-center">
                <div className="text-right">
                    <div className="text-[10px] text-text-secondary uppercase tracking-widest">Balance</div>
                    <div className="font-mono text-sm text-white">
                        <span className="text-neon-cyan">$</span>
                        {parseFloat(balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                </div>
            </header>

            {/* Rest of the component remains the same... */}
            {/* 2. Price Hero */}
            <div className="relative overflow-hidden mb-6">
                {metadata && (
                    <div className="absolute inset-0 opacity-30 pointer-events-none mix-blend-screen">
                        <img
                            src={metadata.image}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-void via-void/80 to-transparent" />
                    </div>
                )}

                <div className="px-6 py-8 relative z-10">
                    <div className="flex items-start gap-4 mb-4">
                        {/* Market Icon */}
                        <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0">
                            <img
                                src={metadata?.image || '/markets/bitcoin.png'}
                                alt=""
                                className="w-8 h-8 object-contain"
                                onError={(e) => {
                                    // Fallback to a simple icon if image fails
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                        </div>

                        <div className="flex-1 min-w-0">
                            <h1 className="text-2xl font-heading font-bold text-white mb-2 leading-tight drop-shadow-md">
                                {market.question}
                                {isLoadingReal && <span className="text-xs text-yellow-400 ml-2">(Loading...)</span>}
                            </h1>
                        </div>
                    </div>

                    {metadata && (
                        <p className="text-sm text-white/70 mb-4 line-clamp-3 leading-relaxed max-w-[90%] backdrop-blur-sm bg-black/20 p-2 rounded-lg border border-white/5">
                            {metadata.description}
                        </p>
                    )}

                    <div className="flex items-end gap-3 mt-4">
                        <div className={`text-5xl font-mono font-bold tracking-tighter ${chartView === 'YES' ? 'text-neon-green text-shadow-green' : 'text-neon-coral text-shadow-red'}`}>
                            {currentPrice.toFixed(1)}%
                        </div>
                        <div className="text-sm font-mono text-text-secondary mb-2 uppercase tracking-wider">Chance</div>
                    </div>
                </div>
            </div>

            {/* 3. Chart - Lazy loaded */}
            <div className="h-[220px] w-full mb-6 relative">
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-void to-transparent z-10 pointer-events-none" />
                <Suspense fallback={<div className="h-full bg-white/5 rounded-lg animate-pulse" />}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="mobileColorPrimary" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={chartView === 'YES' ? "#27E8A7" : "#FF2E63"} stopOpacity={0.4} />
                                    <stop offset="95%" stopColor={chartView === 'YES' ? "#27E8A7" : "#FF2E63"} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="time" hide />
                            <YAxis domain={[0, 100]} hide />
                            <Area
                                type="monotone"
                                dataKey={chartView === 'YES' ? 'yesPrice' : 'noPrice'}
                                name={chartView === 'YES' ? 'YES' : 'NO'}
                                stroke={chartView === 'YES' ? "#27E8A7" : "#FF2E63"}
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#mobileColorPrimary)"
                                animationDuration={0}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </Suspense>
            </div>

            {/* 4. Outcome selector */}
            <div className="px-6 mb-6 flex gap-3">
                <button
                    onClick={() => { setChartView('YES'); setSelectedOutcomeIndex(0); }}
                    className={`flex-1 py-3 rounded-xl text-xs font-bold font-mono tracking-wider transition-all border ${chartView === 'YES'
                        ? 'bg-neon-green/10 border-neon-green text-neon-green shadow-[0_0_15px_rgba(39,232,167,0.2)]'
                        : 'bg-white/5 border-white/5 text-white/40'
                        }`}
                >
                    {market.outcomes?.[0] || 'YES'} {market.yesOdds.toFixed(0)}%
                </button>
                <button
                    onClick={() => { setChartView('NO'); setSelectedOutcomeIndex(1); }}
                    className={`flex-1 py-3 rounded-xl text-xs font-bold font-mono tracking-wider transition-all border ${chartView === 'NO'
                        ? 'bg-neon-coral/10 border-neon-coral text-neon-coral shadow-[0_0_15px_rgba(255,46,99,0.2)]'
                        : 'bg-white/5 border-white/5 text-white/40'
                        }`}
                >
                    {market.outcomes?.[1] || 'NO'} {market.noOdds.toFixed(0)}%
                </button>
            </div>

            {/* 5. Metrics Cards */}
            <div className="px-4 grid grid-cols-2 gap-4 mb-10">
                <Suspense fallback={<div className="p-4 bg-white/5 rounded-lg animate-pulse h-16" />}>
                    <GlassCard className="p-4 !bg-white/5">
                        <div className="flex items-center gap-2 mb-2">
                            <Activity size={14} className="text-neon-cyan" />
                            <span className="text-[10px] text-text-secondary uppercase tracking-widest">Volume</span>
                        </div>
                        <div className="font-mono text-lg text-white font-medium">${market.totalVolume}</div>
                    </GlassCard>
                </Suspense>
                <Suspense fallback={<div className="p-4 bg-white/5 rounded-lg animate-pulse h-16" />}>
                    <GlassCard className="p-4 !bg-white/5">
                        <div className="flex items-center gap-2 mb-2">
                            <BarChart2 size={14} className="text-neon-purple" />
                            <span className="text-[10px] text-text-secondary uppercase tracking-widest">Liquidity</span>
                        </div>
                        <div className="font-mono text-lg text-white font-medium">
                            ${parseFloat(market.liquidityParam || '0').toFixed(0)}
                        </div>
                    </GlassCard>
                </Suspense>
            </div>

            {/* Market Status or Trade Actions */}
            {market && (Date.now() / 1000 > market.endTime || market.resolved || market.assertionPending) ? (
                <div className="px-6 pb-24">
                    <ResolutionPanel
                        marketId={market.id}
                        question={market.question}
                        endTime={market.endTime}
                        resolved={market.resolved}
                        outcome={market.outcome}
                        assertionPending={market.assertionPending}
                        assertedOutcome={market.assertedOutcome}
                        asserter={market.asserter}
                    />
                </div>
            ) : (
                <>
                    {/* Action Buttons - Multi-outcome aware */}
                    {(market.outcomes?.length || 0) > 2 ? (
                        /* Multi-outcome: Show all outcomes as tappable rows */
                        <div className="px-6 mb-8 space-y-3">
                            <div className="text-xs text-text-secondary uppercase tracking-widest mb-2">Select Outcome</div>
                            {market.outcomes?.map((outcome, index) => {
                                const price = market.prices?.[index] || 0;
                                const color = OUTCOME_COLORS[index % OUTCOME_COLORS.length];
                                return (
                                    <button
                                        key={index}
                                        onClick={() => {
                                            setTradeSide(outcome);
                                            setSelectedOutcomeIndex(index);
                                            setIsTradeSheetOpen(true);
                                        }}
                                        className="w-full p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between active:scale-[0.98] transition-all hover:border-white/30"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: color }}
                                            />
                                            <span className="font-medium text-white text-left">{outcome}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-lg" style={{ color }}>
                                                {Math.round(price)}%
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        /* Binary: Show YES/NO buttons */
                        <div className="px-6 mb-8 flex gap-4">
                            <button
                                onClick={() => { setTradeSide('YES'); setSelectedOutcomeIndex(0); setIsTradeSheetOpen(true); }}
                                className="flex-1 py-4 rounded-xl bg-outcome-a text-black font-bold text-lg shadow-[0_0_20px_rgba(74,222,128,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                BUY {market.outcomes?.[0] || 'YES'}
                            </button>
                            <button
                                onClick={() => { setTradeSide('NO'); setSelectedOutcomeIndex(1); setIsTradeSheetOpen(true); }}
                                className="flex-1 py-4 rounded-xl bg-outcome-b text-black font-bold text-lg shadow-[0_0_20px_rgba(248,113,113,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                BUY {market.outcomes?.[1] || 'NO'}
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* 7. Other Markets */}
            <div className="px-4 pb-4">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-4 px-2">Live Feeds</h3>
                <div className="space-y-3">
                    {markets.filter(m => m.id !== market.id).map(m => {
                        const marketMetadata = getMarketMetadata(m.question, m.id);
                        return (
                            <div
                                key={m.id}
                                onClick={() => {
                                    setSelectedMarketId(m.id);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                            >
                                <GlassCard
                                    className="p-4 active:scale-[0.98] transition-all duration-200"
                                >
                                    <div className="flex items-center gap-3">
                                        {/* Market Icon */}
                                        <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                            <img
                                                src={marketMetadata.image}
                                                alt=""
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    // Fallback to a simple icon if image fails
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-medium text-white line-clamp-2 leading-snug mb-1">{m.question}</h4>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-white/50">{marketMetadata.category}</span>
                                                <span className={`font-mono text-lg font-bold ${m.yesOdds >= 50 ? 'text-neon-green' : 'text-neon-coral'}`}>
                                                    {m.yesOdds.toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </GlassCard>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Bottom Sheet */}
            <AnimatePresence>
                {isTradeSheetOpen && (
                    <TradeBottomSheet
                        isOpen={isTradeSheetOpen}
                        onClose={() => setIsTradeSheetOpen(false)}
                        market={market}
                        side={tradeSide}
                        outcomeIndex={selectedOutcomeIndex}
                        balance={balance}
                        onTradeSuccess={fetchData}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// Mobile Trade Sheet
function TradeBottomSheet({ isOpen, onClose, market, side, outcomeIndex = 0, balance, onTradeSuccess }: {
    isOpen: boolean;
    onClose: () => void;
    market: Market;
    side: string; // Changed from 'YES' | 'NO' to support multi-outcome names
    outcomeIndex?: number;
    balance: string;
    onTradeSuccess: () => void;
}) {
    const [amount, setAmount] = useState('100');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { signer, address, isConnected, connect } = useWallet();

    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successData, setSuccessData] = useState<TradeSuccessData | null>(null);

    // Get price for selected outcome (multi-outcome aware)
    const isMultiOutcome = (market.outcomes?.length || 0) > 2;
    const currentPrice = isMultiOutcome
        ? (market.prices?.[outcomeIndex] || 50)
        : (side === 'YES' ? market.yesOdds : (100 - market.yesOdds));
    const outcomeName = isMultiOutcome
        ? (market.outcomes?.[outcomeIndex] || `Option ${outcomeIndex}`)
        : side;
    const estShares = parseFloat(amount || '0') / (currentPrice / 100);
    const outcomeColor = isMultiOutcome ? OUTCOME_COLORS[outcomeIndex % OUTCOME_COLORS.length] : (side === 'YES' ? '#27E8A7' : '#FF2E63');

    const handleBuy = async () => {
        if (!amount || parseFloat(amount) <= 0) return;
        setLoading(true);
        setError(null);

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL;
            const response = await fetch(`${apiUrl}/api/bet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: address,
                    marketId: market.id,
                    side,
                    outcomeIndex, // Multi-outcome support
                    shares: estShares,
                    amount: parseFloat(amount)
                })
            });
            const data = await response.json();
            if (data.success) {
                setSuccessData({
                    marketId: market.id,
                    side,
                    shares: data.transaction?.shares || estShares,
                    cost: amount,
                    question: market.question,
                    newPrice: data.transaction?.newPrice || currentPrice,
                    hash: data.transaction?.hash || '0x'
                });
                setIsSuccessModalOpen(true);
            } else {
                setError(data.error || 'Trade failed');
            }
        } catch (e: any) {
            console.error('Trade error:', e);
            setError(e.message || 'Failed to execute trade');
        } finally {
            setLoading(false);
        }
    };

    const colorClass = side === 'YES' ? 'text-neon-green' : 'text-neon-coral';

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">

            <SuccessModal
                isOpen={isSuccessModalOpen}
                onClose={() => {
                    setIsSuccessModalOpen(false);
                    onClose();
                    onTradeSuccess();
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

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />

            <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="bg-surface border-t border-white/10 w-full rounded-t-3xl p-6 relative z-10 max-h-[80vh] overflow-y-auto"
            >
                <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-8" />

                <div className="flex justify-between items-center mb-8">
                    <div>
                        <div className="text-xs text-text-secondary uppercase tracking-widest mb-1">Position</div>
                        <h3
                            className="text-2xl font-heading font-bold"
                            style={{ color: outcomeColor }}
                        >
                            BUY {outcomeName.toUpperCase()}
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-white/50 hover:bg-white/10 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between text-xs text-text-secondary uppercase tracking-widest mb-3">
                            <span>Amount (USDC)</span>
                            <span>Bal: ${parseFloat(balance).toLocaleString()}</span>
                        </div>
                        <div className="relative group">
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 pl-12 text-2xl font-mono text-white focus:outline-none focus:border-neon-cyan/50 focus:shadow-[0_0_20px_rgba(0,240,255,0.1)] transition-all"
                            />
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-neon-cyan transition-colors" size={20} />
                        </div>
                    </div>

                    <GlassCard className="p-4 !bg-white/5 space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-white/50">Entry Price</span>
                            <span className="font-mono text-white">${(currentPrice / 100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-t border-white/5 pt-3">
                            <span className="text-white/50">Est. Shares</span>
                            <span className="font-mono text-xl font-bold" style={{ color: outcomeColor }}>{estShares.toFixed(2)}</span>
                        </div>
                    </GlassCard>

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    <div className="mt-6">
                        {!isConnected ? (
                            <NeonButton onClick={() => connect()} variant="cyan" className="w-full text-lg py-4">
                                CONNECT TO TRADE
                            </NeonButton>
                        ) : (
                            <NeonSlider
                                onConfirm={handleBuy}
                                isLoading={loading}
                                side={side}
                                disabled={loading || !amount || parseFloat(balance) === 0}
                            />
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}