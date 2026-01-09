"use client";

import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, Wallet, ArrowDown } from "lucide-react";
import { useWallet } from "@/lib/use-wallet";
import { web3Service } from '@/lib/web3';
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { SlideToConfirm } from "@/components/ui/SlideToConfirm";
import { SuccessModal } from "@/components/ui/SuccessModal";
import { AlertModal } from "@/components/ui/AlertModal";
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { getContracts } from '@/lib/contracts';
import { useWeb3Modal } from '@web3modal/wagmi/react';

// Reusing same constants - ideally these should be shared in a generic hook or config
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
}

export function MobileTerminal() {
    const [markets, setMarkets] = useState<Market[]>([]);
    const [selectedMarketId, setSelectedMarketId] = useState<number>(0);
    const [balance, setBalance] = useState<string>('0');
    const [loading, setLoading] = useState(true);
    const [priceHistory, setPriceHistory] = useState<{ time: string, price: number }[]>([]);
    const [chartView, setChartView] = useState<'YES' | 'NO'>('YES');
    const [isTradeSheetOpen, setIsTradeSheetOpen] = useState(false);
    const [tradeSide, setTradeSide] = useState<'YES' | 'NO'>('YES');

    const { isConnected, address } = useWallet();
    const { open } = useWeb3Modal();

    const market = markets.find(m => m.id === selectedMarketId) || markets[0];
    const chartData = (priceHistory.length > 0 ? priceHistory : [{ time: 'Now', price: market?.yesOdds || 50 }])
        .map(point => ({
            time: point.time,
            price: chartView === 'YES' ? point.price : (100 - point.price)
        }));

    // Data Fetching Logic (Duplicated from Desktop for now, should be a hook)
    useEffect(() => {
        async function fetchPriceHistory() {
            if (selectedMarketId === undefined) return;
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL;
                if (apiUrl) {
                    const response = await fetch(`${apiUrl}/api/markets/${selectedMarketId}/price-history?limit=20`);
                    const data = await response.json();
                    if (data.success && data.history?.length > 0) {
                        setPriceHistory(data.history);
                    } else {
                        setPriceHistory([{ time: 'Now', price: market?.yesOdds || 50 }]);
                    }
                }
            } catch (error) {
                setPriceHistory([{ time: 'Now', price: market?.yesOdds || 50 }]);
            }
        }
        fetchPriceHistory();
    }, [selectedMarketId, market?.yesOdds]);

    useEffect(() => {
        if (!isConnected) { setLoading(false); return; }
        async function fetchData() {
            try {
                const allMarkets = await web3Service.getMarkets();
                setMarkets(allMarkets);
                const depositedBalance = await web3Service.getDepositedBalance(address!);
                setBalance(depositedBalance);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, [isConnected, address]);

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center h-screen p-6 text-center">
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <Wallet className="text-primary w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Connect to Trade</h2>
                <p className="text-white/50 mb-8 text-sm">Access markets directly from your phone.</p>
                <button
                    onClick={() => open()}
                    className="w-full py-4 bg-primary text-black font-bold rounded-xl shadow-[0_0_20px_rgba(0,255,148,0.3)]"
                >
                    Connect Wallet
                </button>
            </div>
        );
    }

    if (loading) return <div className="p-6"><SkeletonLoader /></div>;
    if (!market) return <div className="p-6 text-white/50">No markets found.</div>;

    const currentPrice = chartView === 'YES' ? market.yesOdds : (100 - market.yesOdds);
    const priceColor = chartView === 'YES' ? "#00FF94" : "#FF4444";

    return (
        <div className="pb-32 relative"> {/* Padding for bottom nav + action bar */}

            {/* 1. Header: Market Selector */}
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#0A0A0C]/80 backdrop-blur-md sticky top-0 z-20">
                <div onClick={() => {/* TODO: Open market drawer */ }} className="flex items-center gap-2">
                    <div className="text-lg font-bold font-mono text-white">#{market.id}</div>
                    <ArrowDown size={14} className="text-white/40" />
                </div>
                <div className="flex flex-col items-end">
                    <div className="text-xs text-white/40">Balance</div>
                    <div className="font-mono text-white text-sm">${parseFloat(balance).toLocaleString()}</div>
                </div>
            </div>

            {/* 2. Main Price Header */}
            <div className="px-4 py-6">
                <h1 className="text-xl font-bold text-white mb-1 leading-snug">{market.question}</h1>
                <div className="flex items-baseline gap-3 mt-2">
                    <div className={`text-4xl font-mono font-bold ${chartView === 'YES' ? 'text-success' : 'text-danger'}`}>
                        {currentPrice.toFixed(1)}%
                    </div>
                    <div className="text-white/40 text-sm">Probability</div>
                </div>
            </div>

            {/* 3. Toggles */}
            <div className="px-4 mb-4 flex gap-2">
                <button
                    onClick={() => setChartView('YES')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${chartView === 'YES' ? 'bg-success/20 text-success border border-success/30' : 'bg-white/5 text-white/40'}`}
                >
                    YES POOL
                </button>
                <button
                    onClick={() => setChartView('NO')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${chartView === 'NO' ? 'bg-danger/20 text-danger border border-danger/30' : 'bg-white/5 text-white/40'}`}
                >
                    NO POOL
                </button>
            </div>

            {/* 4. Chart */}
            <div className="h-[250px] w-full mb-6">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="mobileColor" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={priceColor} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={priceColor} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="time" hide />
                        <YAxis domain={[0, 100]} hide />
                        <Area
                            type="monotone"
                            dataKey="price"
                            stroke={priceColor}
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#mobileColor)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* 5. Stats Grid */}
            <div className="px-4 grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white/5 p-3 rounded-xl">
                    <div className="text-xs text-white/40 mb-1">Volume</div>
                    <div className="font-mono text-white">${market.totalVolume}</div>
                </div>
                <div className="bg-white/5 p-3 rounded-xl">
                    <div className="text-xs text-white/40 mb-1">Total Shares</div>
                    <div className="font-mono text-white">
                        {(parseFloat(market.yesShares) + parseFloat(market.noShares)).toFixed(0)}
                    </div>
                </div>
            </div>

            {/* 6. Upcoming: Market Scroll Area */}
            <div className="px-4 pb-4">
                <h3 className="text-sm text-white/40 uppercase tracking-widest mb-4">Other Markets</h3>
                <div className="space-y-3">
                    {markets.filter(m => m.id !== market.id).map(m => (
                        <div key={m.id} onClick={() => setSelectedMarketId(m.id)} className="p-4 bg-white/5 rounded-xl flex justify-between items-center active:bg-white/10 transition-colors">
                            <div className="flex-1 mr-4">
                                <div className="text-sm text-white line-clamp-1">{m.question}</div>
                            </div>
                            <div className={`font-mono text-sm font-bold ${m.yesOdds >= 50 ? 'text-success' : 'text-danger'}`}>
                                {m.yesOdds.toFixed(0)}%
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 7. Action Bar (Fixed above BottomNav) */}
            <div className="fixed bottom-[65px] left-0 w-full px-4 py-3 bg-[#0A0A0C] border-t border-white/10 flex gap-3 z-40">
                <button
                    onClick={() => { setTradeSide('YES'); setIsTradeSheetOpen(true); }}
                    className="flex-1 py-3 bg-success text-black font-bold rounded-xl active:scale-95 transition-transform"
                >
                    Buy YES
                </button>
                <button
                    onClick={() => { setTradeSide('NO'); setIsTradeSheetOpen(true); }}
                    className="flex-1 py-3 bg-danger text-black font-bold rounded-xl active:scale-95 transition-transform"
                >
                    Buy NO
                </button>
            </div>

            {/* Trade Bottom Sheet Overlay */}
            {isTradeSheetOpen && (
                <TradeBottomSheet
                    isOpen={isTradeSheetOpen}
                    onClose={() => setIsTradeSheetOpen(false)}
                    market={market}
                    side={tradeSide}
                    balance={balance}
                />
            )}
        </div>
    );
}

// Mobile Trade Sheet Component
function TradeBottomSheet({ isOpen, onClose, market, side, balance }: { isOpen: boolean; onClose: () => void; market: Market; side: 'YES' | 'NO'; balance: string }) {
    const [amount, setAmount] = useState('100');
    const [loading, setLoading] = useState(false);
    const { address } = useWallet();
    const { writeContract } = useWriteContract();

    // ... duplicated trade logic or refactored hook ...
    // Simplified for mobile view:
    const currentPrice = side === 'YES' ? market.yesOdds : (100 - market.yesOdds);
    const estShares = parseFloat(amount) / (currentPrice / 100);

    const handleBuy = async () => {
        setLoading(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL;
            if (apiUrl) {
                // API Call
                await fetch(`${apiUrl}/api/bet`, {
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
            } else {
                // Contract Call
                const sharesInUnits = parseUnits(estShares.toString(), 6);
                const maxCost = parseUnits(amount, 6);
                writeContract({
                    address: MARKET_CONTRACT,
                    abi: MARKET_ABI,
                    functionName: 'buyShares',
                    args: [BigInt(market.id), side === 'YES', sharesInUnits, maxCost],
                });
            }
            onClose();
            // Ideally show success toast
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-[#121214] w-full rounded-t-3xl p-6 relative z-10 animate-in slide-in-from-bottom duration-300 border-t border-white/10">
                <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6" />

                <h3 className="text-xl font-bold text-white mb-6">Buy {side}</h3>

                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between text-sm text-white/50 mb-2">
                            <span>Amount</span>
                            <span>Bal: ${parseFloat(balance).toLocaleString()}</span>
                        </div>
                        <div className="relative">
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-2xl font-mono text-white focus:outline-none focus:border-primary/50"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30">USDC</span>
                        </div>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl">
                        <span className="text-white/50">Est. Shares</span>
                        <span className="text-xl font-mono text-primary">{estShares.toFixed(2)}</span>
                    </div>

                    <SlideToConfirm
                        onConfirm={handleBuy}
                        isLoading={loading}
                        text={`SLIDE TO BUY ${side}`}
                        side={side}
                        disabled={loading || !amount}
                    />
                </div>
            </div>
        </div>
    );
}
