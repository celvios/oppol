"use client";

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { TrendingUp, Wallet, ArrowDown, X, Activity, DollarSign, BarChart2, MessageCircle } from "lucide-react";
import { ReownConnectButton } from "@/components/ui/ReownConnectButtonLite";
import { web3MultiService as web3Service, MultiMarket as Market } from '@/lib/web3-multi';
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/lib/store";
import { useWallet } from "@/lib/use-wallet";
import { AnimatePresence, motion } from "framer-motion";
import CommentsSection from "@/components/market/CommentsSection";
import NeonButton from "@/components/ui/NeonButton";

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
        const contracts = getContracts() as Record<string, string>;
        return (contracts.predictionMarket || '') as `0x${string}`;
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

interface MobileTerminalProps {
    initialMarkets?: Market[];
}

export function MobileTerminal({ initialMarkets = [] }: MobileTerminalProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
    const [showWalletModal, setShowWalletModal] = useState(false);
    const [selectedMarketId, setSelectedMarketId] = useState<number>(0);
    const [errorInfo, setErrorInfo] = useState<string | null>(null);

    // Use server-provided data if available (SSR = instant load!)
    const [markets, setMarkets] = useState<Market[]>(initialMarkets);
    const [balance, setBalance] = useState<string>('0');
    const [loading, setLoading] = useState(initialMarkets.length === 0); // No loading if we have initial data!
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

    // Handle marketId from URL query parameter
    useEffect(() => {
        const urlId = Number(searchParams.get('marketId'));
        if (urlId && !isNaN(urlId) && markets.length > 0) {
            const marketExists = markets.find(m => m.id === urlId);
            if (marketExists) {
                setSelectedMarketId(urlId);
            }
            // Removed fallback: else if (markets.length > 0) { setSelectedMarketId(markets[0].id); }
        } else if (markets.length > 0 && selectedMarketId === 0) {
            // No URL param, set to first market
            setSelectedMarketId(markets[0].id);
        }
    }, [searchParams, markets, selectedMarketId]);

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

    const market = markets.find(m => m.id === selectedMarketId); // Removed fallback to markets[0]

    // Fetch specific market if missing (deep link support)
    useEffect(() => {
        if (selectedMarketId && !market && !loading && !isLoadingReal && mounted) {
            console.log(`[MobileTerminal] Market ${selectedMarketId} missing, fetching details...`);
            setIsLoadingReal(true);
            web3Service.getMarket(selectedMarketId).then(fetchedMarket => {
                if (fetchedMarket) {
                    setMarkets(prev => {
                        if (prev.find(m => m.id === fetchedMarket.id)) return prev;
                        return [...prev, fetchedMarket];
                    });
                }
            }).catch(e => {
                console.error("Failed to fetch specific market", e);
            }).finally(() => {
                setIsLoadingReal(false);
            });
        }
    }, [selectedMarketId, market, loading, isLoadingReal, mounted]);
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
        .map(point => {
            const dataPoint: Record<string, string | number> = { time: point.time };
            // Handle binary markets (Yes/No) explicitly
            if (market?.outcomes?.length === 2) {
                dataPoint[market.outcomes[0]] = point.price;
                dataPoint[market.outcomes[1]] = 100 - point.price;
            } else {
                // For multi-outcome, we currently only track the primary price in history
                // TODO: Update backend to return full multi-outcome history
                market?.outcomes?.forEach((outcome, idx) => {
                    // Distribute remaining % or use placeholder
                    dataPoint[outcome] = idx === 0 ? point.price : (100 - point.price) / ((market.outcomes?.length || 1) - 1);
                });
            }
            return dataPoint;
        });

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

    // Single consolidated data fetch - runs once on mount
    const fetchData = useCallback(async () => {
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

            // Set initial market selection
            if (selectedMarketId === 0 && allMarkets.length > 0) {
                const urlId = Number(searchParams.get('marketId'));
                if (urlId && allMarkets.find(m => m.id === urlId)) {
                    setSelectedMarketId(urlId);
                } else {
                    setSelectedMarketId(allMarkets[0].id);
                }
            }
        } catch (error: unknown) {
            console.error('[MobileTerminal] Error:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            setMarketError(message || 'Failed to load markets');

            if (retryCount < 2) {
                setTimeout(() => setRetryCount(prev => prev + 1), 1000);
            }
        } finally {
            setLoading(false);
            setIsLoadingReal(false);
        }
    }, [address, retryCount, selectedMarketId, searchParams]);

    // Initial fetch on mount
    useEffect(() => {
        fetchData();
    }, []);

    // Refresh balance when wallet connects/changes
    useEffect(() => {
        if (address) {
            web3Service.getDepositedBalance(address).then(setBalance).catch(() => setBalance('0'));
        }
    }, [address]);

    // Polling for live updates (60s to reduce RPC usage)
    useEffect(() => {
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, [fetchData]);

    // Trigger retry when retryCount changes
    useEffect(() => {
        if (retryCount > 0) {
            fetchData();
        }
    }, [retryCount]);

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

    if (!market) {
        if (isLoadingReal) {
            return <div className="p-6"><SkeletonLoader /></div>;
        }
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] text-white/50 p-6 text-center">
                <Activity size={48} className="mb-4 opacity-50" />
                <h2 className="text-xl font-bold mb-2 text-white">Market Not Found</h2>
                <p className="text-sm">This market may not exist or hasn't loaded yet.</p>
                <button
                    onClick={() => { setSelectedMarketId(markets[0]?.id || 0); }}
                    className="mt-4 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 text-white transition-colors"
                >
                    Go to Featured Market
                </button>
            </div>
        );
    }

    const currentPrice = chartView === 'YES' ? (market.yesOdds || 50) : (100 - (market.yesOdds || 50));
    const priceColor = chartView === 'YES' ? "#27E8A7" : "#FF2E63";

    return (
        <div className="pb-12 relative min-h-screen">

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
                        <div className={`text-5xl font-mono font-bold tracking-tighter text-white`}>
                            {((market.outcomes?.length || 2) > 2 ? Math.max(...(market.prices || [market.yesOdds || 50])) : (market.yesOdds || 50)).toFixed(1)}%
                        </div>
                        <div className="text-sm font-mono text-text-secondary mb-2 uppercase tracking-wider">
                            {(market.outcomes?.length || 2) > 2 ? 'Top Prediction' : 'Yes Chance'}
                        </div>
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
                                {(market.outcomes || ["YES", "NO"]).map((outcome, index) => {
                                    let color;
                                    const lower = outcome.toLowerCase();
                                    if (lower === 'yes') color = '#27E8A7'; // Neon Green
                                    else if (lower === 'no') color = '#FF2E63'; // Neon Coral/Red
                                    else color = OUTCOME_COLORS[index % OUTCOME_COLORS.length];

                                    return (
                                        <linearGradient key={outcome} id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                                        </linearGradient>
                                    );
                                })}
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="time" hide />
                            <YAxis domain={[0, 100]} hide />
                            {(market.outcomes || ["YES", "NO"]).map((outcome, index) => {
                                let color;
                                const lower = outcome.toLowerCase();
                                if (lower === 'yes') color = '#27E8A7';
                                else if (lower === 'no') color = '#FF2E63';
                                else color = OUTCOME_COLORS[index % OUTCOME_COLORS.length];

                                return (
                                    <Area
                                        key={outcome}
                                        type="monotone"
                                        dataKey={outcome}
                                        name={outcome}
                                        stroke={color}
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill={`url(#gradient-${index})`}
                                        animationDuration={0}
                                    />
                                );
                            })}
                        </AreaChart>
                    </ResponsiveContainer>
                </Suspense>
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
            {market && (market.resolved || market.assertionPending) ? (
                <div className="px-6 pb-24">
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
                        onTradeSuccess={() => {
                            if (fetchData) fetchData();
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Comments Section (Mobile) */}
            <div className="px-4 pb-20 mt-8">
                <CommentsSection marketId={market.id} />
            </div>
        </div>
    );
}

// Mobile Trade Sheet
function TradeBottomSheet({ isOpen, onClose, market, side, outcomeIndex = 0, balance, onTradeSuccess }: {
    isOpen: boolean;
    onClose: () => void;
    market: Market;
    side: string;
    outcomeIndex?: number;
    balance: string;
    onTradeSuccess: () => void;
}) {
    const [amount, setAmount] = useState('100');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { address, isConnected, connect } = useWallet();

    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successData, setSuccessData] = useState<TradeSuccessData | null>(null);

    // Get price for selected outcome (multi-outcome aware)
    const isMultiOutcome = (market.outcomes?.length || 0) > 2;
    const currentPrice = isMultiOutcome
        ? (market.prices?.[outcomeIndex] || 50)
        : (side === 'YES' ? (market.yesOdds || 50) : (100 - (market.yesOdds || 50)));
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
                    outcomeIndex,
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
        } catch (e: unknown) {
            console.error('Trade error:', e);
            const message = e instanceof Error ? e.message : 'Unknown trade error';
            setError(message || 'Failed to execute trade');
        } finally {
            setLoading(false);
        }
    };

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
                                color={outcomeColor}
                                disabled={loading || !amount || parseFloat(balance) === 0}
                            />
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}