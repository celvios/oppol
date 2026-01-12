"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip } from 'recharts';
import { TrendingUp, Wallet, ArrowDown, X, Activity, DollarSign, BarChart2 } from "lucide-react";
import { useWallet } from "@/lib/use-wallet";
import { web3Service } from '@/lib/web3';
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import NeonSlider from "@/components/ui/NeonSlider";
import { SuccessModal } from "@/components/ui/SuccessModal";
import { AlertModal } from "@/components/ui/AlertModal";
import { useDisconnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { getContracts } from '@/lib/contracts';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useEIP6963 } from "@/lib/useEIP6963"; // Add import
import { useRouter } from "next/navigation"; // Add import
import GlassCard from "@/components/ui/GlassCard";
import NeonButton from "@/components/ui/NeonButton";
import { ResolutionPanel } from "@/components/ui/ResolutionPanel"; // Add import
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/lib/store"; // Add missing import
import { getMarketMetadata } from "@/lib/market-metadata";

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

const contracts = getContracts() as any;
const MARKET_CONTRACT = (contracts.predictionMarket || '0x5F9C05bE2Af2adb520825950323774eFF308E353') as `0x${string}`;

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

import { useSearchParams } from "next/navigation"; // Add import

export function MobileTerminal() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false); // New state
    // Initialize with 0 to prevent hydration mismatch, update in effect
    const [selectedMarketId, setSelectedMarketId] = useState<number>(0);

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

    // Initial Sync with URL
    useEffect(() => {
        const urlId = Number(searchParams.get('marketId'));
        if (urlId && !isNaN(urlId)) {
            setSelectedMarketId(urlId);
        }
    }, [searchParams]);

    const [markets, setMarkets] = useState<Market[]>([]);
    const [balance, setBalance] = useState<string>('0');
    const [loading, setLoading] = useState(true);
    const [priceHistory, setPriceHistory] = useState<{ time: string, price: number }[]>([]);
    const [chartView, setChartView] = useState<'YES' | 'NO'>('YES');
    const [isTradeSheetOpen, setIsTradeSheetOpen] = useState(false);
    const [tradeSide, setTradeSide] = useState<'YES' | 'NO'>('YES');

    const { isConnected, address } = useWallet();
    const { open } = useWeb3Modal();
    const { setTradeModalOpen } = useUIStore();
    const { disconnect: wagmiDisconnect } = useDisconnect();
    const { disconnect: eipDisconnect, walletState } = useEIP6963();

    const handleLogout = () => {
        localStorage.removeItem('session_token');
        localStorage.removeItem('wallet_address');
        localStorage.removeItem('login_method');
        localStorage.removeItem('cached_wallet_address');
        localStorage.removeItem('connected_wallet_uuid');
        localStorage.removeItem('connected_wallet_name');
        localStorage.clear(); // Clear all localStorage to prevent auto-reconnect
        wagmiDisconnect();
        if (walletState.isConnected) eipDisconnect();
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

    // Animation Loop (Heartbeat)
    useEffect(() => {
        const interval = setInterval(() => {
            if (!marketRef.current) return;

            setPriceHistory(prev => {
                const now = Date.now();
                const timeString = new Date(now).toLocaleTimeString();
                const basePrice = marketRef.current?.yesOdds || 50;
                const waveOffset = Math.sin(now / 800) * 0.5;
                const animatedPrice = basePrice + waveOffset; // YES Price

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
        if (!isConnected || !address) return;
        try {
            const allMarkets = await web3Service.getMarkets();
            setMarkets(allMarkets);

            // Fetch deposited balance directly from contract (same as Portfolio page)
            try {
                const depositedBalance = await web3Service.getDepositedBalance(address);
                setBalance(depositedBalance);
            } catch (e) {
                console.error('[MobileTerminal] Balance fetch error:', e);
                setBalance('0');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [isConnected, address]);

    useEffect(() => {
        if (!isConnected) {
            setLoading(false);
            return;
        }
        fetchData();
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, [isConnected, address, fetchData]);

    if (!mounted || (!isConnected && mounted)) {
        return (
            <div className="p-6">
                <SkeletonLoader />
            </div>
        );
    }

    if (loading) return <div className="p-6"><SkeletonLoader /></div>;
    if (!market) return <div className="p-6 text-white/50 flex items-center justify-center h-[80vh] font-mono">[SYSTEM: NO MARKETS]</div>;

    const currentPrice = chartView === 'YES' ? market.yesOdds : (100 - market.yesOdds);
    const priceColor = chartView === 'YES' ? "#27E8A7" : "#FF2E63";

    return (
        <div className="pb-12 relative min-h-screen">

            {/* 1. Header */}
            <header className="px-4 py-4 pt-6 sticky top-0 z-30 bg-void/80 backdrop-blur-xl border-b border-white/5 flex justify-between items-center">
                <div className="relative">
                    <div
                        onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 active:bg-white/10 transition-colors cursor-pointer"
                    >
                        <div className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />
                        <span className="text-xs font-mono font-bold text-white tracking-widest">
                            {copied ? 'COPIED!' : `${address?.slice(0, 6)}...${address?.slice(-4)}`}
                        </span>
                    </div>

                    {/* Dropdown Menu */}
                    <AnimatePresence>
                        {isHeaderMenuOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute top-full left-0 mt-2 min-w-[160px] bg-surface border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 backdrop-blur-xl"
                            >
                                <button
                                    onClick={() => { copyAddress(); setIsHeaderMenuOpen(false); }}
                                    className="w-full text-left px-4 py-3 text-xs font-mono text-white hover:bg-white/5 transition-colors border-b border-white/5"
                                >
                                    Copy Address
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="w-full text-left px-4 py-3 text-xs font-mono text-neon-coral hover:bg-neon-coral/10 transition-colors font-bold"
                                >
                                    Disconnect
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="text-right">
                    <div className="text-[10px] text-text-secondary uppercase tracking-widest">Balance</div>
                    <div className="font-mono text-sm text-white">
                        <span className="text-neon-cyan">$</span>
                        {parseFloat(balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                </div>
            </header>

            {/* 2. Price Hero */}
            <div className="relative overflow-hidden mb-6">
                {/* Background Image */}
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
                    <h1 className="text-2xl font-heading font-bold text-white mb-2 leading-tight drop-shadow-md relative z-10">
                        {market.question}
                    </h1>

                    {metadata && (
                        <p className="text-sm text-white/70 mb-4 line-clamp-3 leading-relaxed max-w-[90%] backdrop-blur-sm bg-black/20 p-2 rounded-lg border border-white/5">
                            {metadata.description}
                        </p>
                    )}

                    <div className="flex items-end gap-3 mt-4">
                        <div className={`text-5xl font-mono font-bold tracking-tighter ${chartView === 'YES' ? 'text-neon-green text-shadow-green' : 'text-neon-coral text-shadow-red'}`}>
                            {currentPrice.toFixed(1)}%
                        </div>
                        <div className="text-sm font-mono text-text-secondary mb-2 uppercase tracking-wider">Probability</div>
                    </div>
                </div>
            </div>

            {/* 3. Controls */}
            <div className="px-6 mb-6 flex gap-3">
                <button
                    onClick={() => setChartView('YES')}
                    className={`flex-1 py-3 rounded-xl text-xs font-bold font-mono tracking-wider transition-all border ${chartView === 'YES'
                        ? 'bg-neon-green/10 border-neon-green text-neon-green shadow-[0_0_15px_rgba(39,232,167,0.2)]'
                        : 'bg-white/5 border-white/5 text-white/40'
                        }`}
                >
                    YES POOL
                </button>
                <button
                    onClick={() => setChartView('NO')}
                    className={`flex-1 py-3 rounded-xl text-xs font-bold font-mono tracking-wider transition-all border ${chartView === 'NO'
                        ? 'bg-neon-coral/10 border-neon-coral text-neon-coral shadow-[0_0_15px_rgba(255,46,99,0.2)]'
                        : 'bg-white/5 border-white/5 text-white/40'
                        }`}
                >
                    NO POOL
                </button>
            </div>

            {/* 4. Chart */}
            <div className="h-[280px] w-full mb-8 relative">
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-void to-transparent z-10 pointer-events-none" />
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="mobileColorYes" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#27E8A7" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#27E8A7" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="mobileColorNo" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#FF2E63" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#FF2E63" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="time" hide />
                        <YAxis domain={[0, 100]} hide />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(5, 5, 10, 0.9)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px',
                                backdropFilter: 'blur(10px)',
                                fontSize: '12px'
                            }}
                            itemStyle={{ fontFamily: 'var(--font-jetbrains-mono)' }}
                        />
                        {chartView === 'YES' ? (
                            <>
                                <Area
                                    type="monotone"
                                    dataKey="noPrice"
                                    name="NO"
                                    stroke="#FF2E63"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#mobileColorNo)"
                                    className="drop-shadow-[0_0_10px_rgba(255,46,99,0.3)] transition-all duration-500"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="yesPrice"
                                    name="YES"
                                    stroke="#27E8A7"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#mobileColorYes)"
                                    className="drop-shadow-[0_0_10px_rgba(39,232,167,0.3)] transition-all duration-500"
                                />
                            </>
                        ) : (
                            <>
                                <Area
                                    type="monotone"
                                    dataKey="yesPrice"
                                    name="YES"
                                    stroke="#27E8A7"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#mobileColorYes)"
                                    className="drop-shadow-[0_0_10px_rgba(39,232,167,0.3)] transition-all duration-500"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="noPrice"
                                    name="NO"
                                    stroke="#FF2E63"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#mobileColorNo)"
                                    className="drop-shadow-[0_0_10px_rgba(255,46,99,0.3)] transition-all duration-500"
                                />
                            </>
                        )}
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* 5. Metrics Cards */}
            <div className="px-4 grid grid-cols-2 gap-4 mb-10">
                <GlassCard className="p-4 !bg-white/5">
                    <div className="flex items-center gap-2 mb-2">
                        <Activity size={14} className="text-neon-cyan" />
                        <span className="text-[10px] text-text-secondary uppercase tracking-widest">Volume</span>
                    </div>
                    <div className="font-mono text-lg text-white font-medium">${market.totalVolume}</div>
                </GlassCard>
                <GlassCard className="p-4 !bg-white/5">
                    <div className="flex items-center gap-2 mb-2">
                        <BarChart2 size={14} className="text-neon-purple" />
                        <span className="text-[10px] text-text-secondary uppercase tracking-widest">Liquidity</span>
                    </div>
                    <div className="font-mono text-lg text-white font-medium">
                        ${(parseFloat(market.yesPool) + parseFloat(market.noPool)).toFixed(0)}
                    </div>
                </GlassCard>
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
                    {/* Action Buttons */}
                    <div className="px-6 mb-8 flex gap-4">
                        <button
                            onClick={() => { setTradeSide('YES'); setIsTradeSheetOpen(true); }}
                            className="flex-1 py-4 rounded-xl bg-outcome-a text-black font-bold text-lg shadow-[0_0_20px_rgba(74,222,128,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            LONG YES
                        </button>
                        <button
                            onClick={() => { setTradeSide('NO'); setIsTradeSheetOpen(true); }}
                            className="flex-1 py-4 rounded-xl bg-outcome-b text-black font-bold text-lg shadow-[0_0_20px_rgba(248,113,113,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            SHORT NO
                        </button>
                    </div>
                </>
            )}

            {/* 7. Other Markets */}
            <div className="px-4 pb-4">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-4 px-2">Live Feeds</h3>
                <div className="space-y-3">
                    {markets.filter(m => m.id !== market.id).map(m => (
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
                                <div className="flex justify-between items-start">
                                    <h4 className="text-sm font-medium text-white line-clamp-2 w-3/4 leading-snug">{m.question}</h4>
                                    <span className={`font-mono text-sm font-bold ${m.yesOdds >= 50 ? 'text-neon-green' : 'text-neon-coral'}`}>
                                        {m.yesOdds.toFixed(0)}%
                                    </span>
                                </div>
                            </GlassCard>
                        </div>
                    ))}
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
                        balance={balance}
                        onTradeSuccess={fetchData}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// Mobile Trade Sheet
function TradeBottomSheet({ isOpen, onClose, market, side, balance, onTradeSuccess }: { isOpen: boolean; onClose: () => void; market: Market; side: 'YES' | 'NO'; balance: string; onTradeSuccess: () => void }) {
    const [amount, setAmount] = useState('100');
    const [loading, setLoading] = useState(false);
    const { address } = useWallet();
    const { writeContract, data: hash } = useWriteContract();
    const { isSuccess } = useWaitForTransactionReceipt({ hash });

    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successData, setSuccessData] = useState<TradeSuccessData | null>(null);

    const currentPrice = side === 'YES' ? market.yesOdds : (100 - market.yesOdds);
    const estShares = parseFloat(amount || '0') / (currentPrice / 100);

    const handleBuy = async () => {
        if (!amount || parseFloat(amount) <= 0) return;
        setLoading(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL;
            if (apiUrl) {
                const response = await fetch(`${apiUrl}/api/bet`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        walletAddress: address,
                        marketId: market.id,
                        side,
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
                        newPrice: currentPrice, // Placeholder
                        hash: '0x' // Placeholder
                    });
                    setIsSuccessModalOpen(true);
                }
            } else {
                const sharesInUnits = parseUnits(estShares.toFixed(2), 6);
                const maxCost = parseUnits(amount, 6);
                writeContract({
                    address: MARKET_CONTRACT,
                    abi: MARKET_ABI,
                    functionName: 'buyShares',
                    args: [BigInt(market.id), side === 'YES', sharesInUnits, maxCost],
                });
                setSuccessData({
                    marketId: market.id,
                    side,
                    shares: estShares,
                    cost: amount,
                    question: market.question,
                    newPrice: currentPrice, // Placeholder
                    hash: hash || '0x'
                });
                setIsSuccessModalOpen(true);
            }
        } catch (e) {
            console.error(e);
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
                        <h3 className={`text-2xl font-heading font-bold ${side === 'YES' ? 'text-outcome-a' : 'text-outcome-b'}`}>
                            {side === 'YES' ? 'LONG YES' : 'SHORT NO'}
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
                            <span className={`font-mono text-xl font-bold ${side === 'YES' ? 'text-outcome-a' : 'text-outcome-b'}`}>{estShares.toFixed(2)}</span>
                        </div>
                    </GlassCard>

                    <div className="mt-6">
                        <NeonSlider
                            onConfirm={handleBuy}
                            isLoading={loading}
                            side={side}
                            disabled={loading || !amount || parseFloat(balance) === 0}
                        />
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
