"use client";

import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip } from 'recharts';
import { TrendingUp, Wallet, ArrowUpRight, ArrowDownRight, Clock, Activity, AlertCircle } from "lucide-react";
import { useWallet } from "@/lib/use-wallet";
import { web3Service } from '@/lib/web3';
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import NeonSlider from "@/components/ui/NeonSlider";
import { SuccessModal } from "@/components/ui/SuccessModal";
import { AlertModal } from "@/components/ui/AlertModal";
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { getContracts } from '@/lib/contracts';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import GlassCard from "@/components/ui/GlassCard";
import NeonButton from "@/components/ui/NeonButton";
import { ResolutionPanel } from "@/components/ui/ResolutionPanel";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

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

interface PricePoint {
    time: string;
    price: number;
}

interface TradeSuccessData {
    marketId: number;
    side: 'YES' | 'NO';
    shares: number;
    cost: number;
    question: string;
}

export function DesktopTerminal() {
    const [markets, setMarkets] = useState<Market[]>([]);
    const [selectedMarketId, setSelectedMarketId] = useState<number>(0);
    const [balance, setBalance] = useState<string>('0');
    const [loading, setLoading] = useState(true);
    const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
    const [chartView, setChartView] = useState<'YES' | 'NO'>('YES');

    // Trade State
    const [tradeSide, setTradeSide] = useState<'YES' | 'NO'>('YES');
    const [amount, setAmount] = useState('100');
    const [isTradeLoading, setIsTradeLoading] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successData, setSuccessData] = useState<TradeSuccessData | null>(null);

    const { isConnected, address } = useWallet();
    const { open } = useWeb3Modal();
    const { writeContract, data: hash } = useWriteContract();
    const { isSuccess } = useWaitForTransactionReceipt({ hash });

    const market = markets.find(m => m.id === selectedMarketId) || markets[0];

    // --- Data Fetching ---

    const fetchHistory = async (id: number) => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL;
            if (apiUrl) {
                const response = await fetch(`${apiUrl}/api/markets/${id}/price-history?limit=50`);
                const data = await response.json();
                if (data.success && data.history?.length > 0) {
                    setPriceHistory(data.history);
                } else {
                    setPriceHistory([{ time: 'Now', price: market?.yesOdds || 50 }]);
                }
            } else {
                setPriceHistory([{ time: 'Now', price: market?.yesOdds || 50 }]);
            }
        } catch (error) {
            console.error("Failed to fetch history:", error);
            setPriceHistory([{ time: 'Now', price: market?.yesOdds || 50 }]);
        }
    };

    const fetchData = async () => {
        if (!isConnected || !address) return;
        try {
            const allMarkets = await web3Service.getMarkets();
            setMarkets(allMarkets);
            // If checking balance logic...
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL;
                if (apiUrl) {
                    const linkResponse = await fetch(`${apiUrl}/api/wallet/link`, {
                        method: 'POST',
                        body: JSON.stringify({ walletAddress: address })
                    });
                    const linkData = await linkResponse.json();
                    if (linkData.success) {
                        const depositedBalance = await web3Service.getDepositedBalance(linkData.custodialAddress);
                        setBalance(depositedBalance);
                    }
                } else {
                    const depositedBalance = await web3Service.getDepositedBalance(address);
                    setBalance(depositedBalance);
                }
            } catch (e) {
                const depositedBalance = await web3Service.getDepositedBalance(address);
                setBalance(depositedBalance);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isConnected) {
            fetchData();
            if (markets.length > 0 && selectedMarketId === 0) setSelectedMarketId(markets[0].id);
        } else {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected, address]);

    useEffect(() => {
        if (selectedMarketId) fetchHistory(selectedMarketId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMarketId]);

    // --- Trading Logic ---

    const handleTrade = async () => {
        if (!amount || parseFloat(amount) <= 0) return;
        setIsTradeLoading(true);

        const currentPrice = tradeSide === 'YES' ? market.yesOdds : (100 - market.yesOdds);
        // Estimate: amount / (price/100)
        const estShares = parseFloat(amount) / (currentPrice / 100);

        try {
            // Always use custodial API
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
            const response = await fetch(`${apiUrl}/api/bet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: address,
                    marketId: market.id,
                    side: tradeSide,
                    shares: estShares,
                    amount: parseFloat(amount)
                })
            });
            const data = await response.json();
            if (data.success) {
                setSuccessData({
                    marketId: market.id,
                    side: tradeSide,
                    shares: data.transaction?.shares || estShares,
                    cost: parseFloat(amount),
                    question: market.question
                });
                setIsSuccessModalOpen(true);
                fetchData(); // Refresh data
            } else {
                console.error("Trade API error:", data.error);
                // Optionally show error modal here
            }
        } catch (e) {
            console.error("Trade failed:", e);
        } finally {
            setIsTradeLoading(false);
        }
    };

    // Watch for Transaction Success
    useEffect(() => {
        if (isSuccess && !isSuccessModalOpen && market) {
            // Recalculate estimates for success modal
            const currentPrice = tradeSide === 'YES' ? market.yesOdds : (100 - market.yesOdds);
            const estShares = parseFloat(amount) / (currentPrice / 100);

            setSuccessData({
                marketId: market.id,
                side: tradeSide,
                shares: estShares,
                cost: parseFloat(amount),
                question: market.question
            });
            setIsSuccessModalOpen(true);
            fetchData(); // Refresh balances and order book
        }
    }, [isSuccess]);


    if (loading) return <SkeletonLoader />;

    return (
        <div className="flex h-[calc(100vh-80px)] overflow-hidden">
            {/* Main Chart Area */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-white/10 bg-void/50 backdrop-blur-sm">
                {/* Header */}
                <div className="h-16 px-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-heading font-bold text-white tracking-wide">
                                {market?.question}
                            </h2>
                            <span className="px-2 py-0.5 rounded bg-primary/20 border border-primary/30 text-[10px] font-mono text-primary animate-pulse">
                                LIVE
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2 text-text-secondary">
                            <Clock size={14} />
                            <span className="font-mono">{formatDistanceToNow(market?.endTime * 1000, { addSuffix: true })}</span>
                        </div>
                        <div className="flex items-center gap-2 text-text-secondary">
                            <Activity size={14} />
                            <span className="font-mono text-white">$2.4M Vol</span>
                        </div>
                    </div>
                </div>

                {/* Chart */}
                <div className="flex-1 relative p-6">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={priceHistory}>
                            <defs>
                                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={chartView === 'YES' ? '#4ade80' : '#f87171'} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={chartView === 'YES' ? '#4ade80' : '#f87171'} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                            <XAxis
                                dataKey="time"
                                stroke="#ffffff40"
                                tick={{ fill: '#ffffff40', fontSize: 10 }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                domain={[0, 100]}
                                stroke="#ffffff40"
                                tick={{ fill: '#ffffff40', fontSize: 10 }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${value}%`}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="price"
                                stroke={chartView === 'YES' ? '#4ade80' : '#f87171'}
                                strokeWidth={2}
                                fill="url(#colorPrice)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>

                    {/* Chart Controls Overlay */}
                    <div className="absolute top-6 right-6 flex gap-2">
                        <button
                            onClick={() => setChartView('YES')}
                            className={`px-3 py-1 rounded text-xs font-bold transition-colors ${chartView === 'YES' ? 'bg-outcome-a text-black' : 'bg-white/5 text-text-secondary hover:bg-white/10'}`}
                        >
                            YES Odds
                        </button>
                        <button
                            onClick={() => setChartView('NO')}
                            className={`px-3 py-1 rounded text-xs font-bold transition-colors ${chartView === 'NO' ? 'bg-outcome-b text-black' : 'bg-white/5 text-text-secondary hover:bg-white/10'}`}
                        >
                            NO Odds
                        </button>
                    </div>
                </div>

                {/* Resolution Panel (If Resolved) */}
                {market?.resolved && (
                    <div className="px-6 pb-6">
                        <ResolutionPanel
                            marketId={market.id}
                            isInternalAdmin={false} // Connect to real admin logic if needed
                            onResolved={fetchData}
                        />
                    </div>
                )}
            </div>

            {/* Sidebar (Order Book & Trade) */}
            <div className="w-[380px] flex flex-col border-l border-white/10 bg-surface/50 backdrop-blur-md">
                {/* Order Book Mockup */}
                <div className="flex-1 p-4 border-b border-white/10 overflow-y-auto custom-scrollbar">
                    <h3 className="text-xs font-bold text-text-secondary uppercase mb-4 tracking-wider">Order Book</h3>
                    <div className="space-y-1">
                        {[65, 64, 63, 62, 60].map((price, i) => (
                            <div key={`sell-${i}`} className="flex justify-between text-xs group hover:bg-white/5 p-1 rounded cursor-pointer">
                                <span className="text-outcome-b opacity-80 group-hover:opacity-100 transition-opacity">{price + 2}¢</span>
                                <span className="text-white/40 group-hover:text-white transition-colors">{(Math.random() * 5000).toFixed(0)}</span>
                            </div>
                        ))}
                        <div className="py-2 border-y border-white/5 my-2 text-center">
                            <span className="text-lg font-bold text-white tracking-widest">{market?.yesOdds}¢</span>
                        </div>
                        {[59, 58, 57, 56, 55].map((price, i) => (
                            <div key={`buy-${i}`} className="flex justify-between text-xs group hover:bg-white/5 p-1 rounded cursor-pointer">
                                <span className="text-outcome-a opacity-80 group-hover:opacity-100 transition-opacity">{price}¢</span>
                                <span className="text-white/40 group-hover:text-white transition-colors">{(Math.random() * 5000).toFixed(0)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Trade Panel */}
                <div className="p-6 bg-black/20">
                    <div className="flex bg-black/40 p-1 rounded-xl mb-6">
                        <button
                            onClick={() => setTradeSide('YES')}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all relative overflow-hidden ${tradeSide === 'YES' ? 'text-black shadow-lg shadow-outcome-a/20' : 'text-text-secondary hover:text-white'}`}
                        >
                            {tradeSide === 'YES' && (
                                <motion.div layoutId="activeTab" className="absolute inset-0 bg-outcome-a rounded-lg" />
                            )}
                            <span className="relative z-10">Vote YES</span>
                        </button>
                        <button
                            onClick={() => setTradeSide('NO')}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all relative overflow-hidden ${tradeSide === 'NO' ? 'text-black shadow-lg shadow-outcome-b/20' : 'text-text-secondary hover:text-white'}`}
                        >
                            {tradeSide === 'NO' && (
                                <motion.div layoutId="activeTab" className="absolute inset-0 bg-outcome-b rounded-lg" />
                            )}
                            <span className="relative z-10">Vote NO</span>
                        </button>
                    </div>

                    <div className="space-y-4 mb-6">
                        <div>
                            <div className="flex justify-between text-xs mb-2">
                                <span className="text-text-secondary font-mono">AMOUNT (USDC)</span>
                                <span className="text-white font-mono cursor-pointer hover:text-primary transition-colors">
                                    Bal: ${balance}
                                </span>
                            </div>
                            <div className="relative group">
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-white font-mono text-lg focus:outline-none focus:border-primary/50 transition-colors"
                                    placeholder="0.00"
                                />
                                <button
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold bg-white/10 hover:bg-white/20 text-text-secondary px-2 py-1 rounded transition-colors"
                                    onClick={() => setBalance(prev => amount)} // Mock max
                                >
                                    MAX
                                </button>
                            </div>
                        </div>

                        <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-text-secondary">Est. Shares</span>
                                <span className="text-white font-mono font-bold">
                                    {(parseFloat(amount || '0') / (market?.[tradeSide === 'YES' ? 'yesOdds' : 'noOdds'] / 100 || 0.5)).toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-text-secondary">Potential Return</span>
                                <span className="text-outcome-a font-mono font-bold">
                                    ${(parseFloat(amount || '0') / (market?.[tradeSide === 'YES' ? 'yesOdds' : 'noOdds'] / 100 || 0.5)).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {!isConnected ? (
                        <button
                            onClick={() => open()}
                            className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all border border-white/5 flex items-center justify-center gap-2"
                        >
                            <Wallet size={18} />
                            Connect Wallet
                        </button>
                    ) : (
                        <NeonSlider
                            side={tradeSide}
                            onConfirm={handleTrade}
                            isLoading={isTradeLoading}
                        />
                    )}
                </div>
            </div>

            {/* Success Modal */}
            <SuccessModal
                isOpen={isSuccessModalOpen}
                onClose={() => setIsSuccessModalOpen(false)}
                data={successData}
            />
        </div>
    );
}
