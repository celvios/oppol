"use client";

import { Activity, Users, DollarSign, TrendingUp, Clock, Wallet } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useEffect, useState } from 'react';
import { web3Service } from '@/lib/web3';
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { SuccessModal } from "@/components/ui/SuccessModal";
import { SlideToConfirm } from "@/components/ui/SlideToConfirm";
import { ResolutionPanel } from "@/components/ui/ResolutionPanel";
import { useWallet } from "@/lib/use-wallet";
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { AlertModal } from "@/components/ui/AlertModal";
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { getContracts } from '@/lib/contracts';

// Market Contract ABI for buyShares
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

export default function TerminalPage() {
    const [markets, setMarkets] = useState<Market[]>([]);
    const [selectedMarketId, setSelectedMarketId] = useState<number>(0);
    const [balance, setBalance] = useState<string>('0');
    const [loading, setLoading] = useState(true);
    const [custodialAddress, setCustodialAddress] = useState<string>('');
    const [priceHistory, setPriceHistory] = useState<{ time: string, price: number }[]>([]);
    const [chartView, setChartView] = useState<'YES' | 'NO'>('YES');

    // Wallet connection state
    const { isConnected, isReconnecting, address } = useWallet();
    const { open } = useWeb3Modal();

    // Get selected market
    const market = markets.find(m => m.id === selectedMarketId) || markets[0];

    // Chart data - use real price history or fallback to current price
    // Calculate NO price as (100 - YES) if NO view is selected
    const chartData = (priceHistory.length > 0 ? priceHistory : [{ time: 'Now', price: market?.yesOdds || 50 }])
        .map(point => ({
            time: point.time,
            price: chartView === 'YES' ? point.price : (100 - point.price)
        }));

    // Fetch price history when market changes
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
                        // No history yet - show current price as single point
                        setPriceHistory([{ time: 'Now', price: market?.yesOdds || 50 }]);
                    }
                }
            } catch (error) {
                console.warn('Failed to fetch price history:', error);
                setPriceHistory([{ time: 'Now', price: market?.yesOdds || 50 }]);
            }
        }
        fetchPriceHistory();
    }, [selectedMarketId, market?.yesOdds]);

    useEffect(() => {
        // Only fetch data if wallet is connected
        if (!isConnected || !address) {
            setLoading(false);
            return;
        }

        async function fetchData() {
            try {
                // Fetch ALL markets first (always works, direct from blockchain)
                const allMarkets = await web3Service.getMarkets();
                setMarkets(allMarkets);

                // Try to link wallet for custodial trading (requires backend)
                try {
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
                    if (apiUrl) {
                        const linkResponse = await fetch(`${apiUrl}/api/wallet/link`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ walletAddress: address })
                        });
                        const linkData = await linkResponse.json();
                        if (linkData.success) {
                            setCustodialAddress(linkData.custodialAddress);
                            // Fetch deposited balance from custodial wallet
                            const depositedBalance = await web3Service.getDepositedBalance(linkData.custodialAddress);
                            setBalance(depositedBalance);
                        }
                    } else {
                        // No backend configured - use direct wallet deposited balance
                        const depositedBalance = await web3Service.getDepositedBalance(address!);
                        setBalance(depositedBalance);
                    }
                } catch (apiError) {
                    console.warn('Backend API not available, using direct wallet balance:', apiError);
                    // Fallback: use connected wallet's deposited balance directly
                    const depositedBalance = await web3Service.getDepositedBalance(address!);
                    setBalance(depositedBalance);
                }
            } catch (error) {
                console.error('Error fetching markets:', error);
            } finally {
                setTimeout(() => setLoading(false), 600);
            }
        }
        fetchData();

        // Auto-refresh every 15 seconds
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, [isConnected, address]);

    // WALLET CONNECTION GATE - Show connect prompt if not connected
    if (!isConnected) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <div className="text-center max-w-md">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                        <Wallet className="w-10 h-10 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3">Connect Your Wallet</h2>
                    <p className="text-white/50 mb-8">
                        Connect your wallet to access the prediction markets, view your positions, and start trading.
                    </p>
                    <button
                        onClick={() => open()}
                        className="px-8 py-4 bg-primary text-black font-bold rounded-xl hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(0,224,255,0.3)]"
                    >
                        Connect Wallet
                    </button>
                    <p className="text-white/30 text-xs mt-6">
                        Supports MetaMask, WalletConnect, Coinbase Wallet & more
                    </p>
                </div>
            </div>
        );
    }

    if (loading) {
        return <SkeletonLoader />;
    }

    if (markets.length === 0) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-white/60">No markets available</div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-end border-b border-white/10 pb-6">
                <div>
                    <h1 className="text-3xl font-mono font-bold text-white mb-2">MARKET OVERVIEW</h1>
                    <p className="text-white/50 text-sm">
                        {markets.length} Active Markets | Selected: <span className="text-primary">#{selectedMarketId}</span>
                    </p>
                </div>
                <div className="flex gap-4">
                    <div className="text-right">
                        <div className="text-xs text-white/40 uppercase tracking-widest mb-1">Your Balance</div>
                        <div className="text-xl font-mono text-white">
                            $ {parseFloat(balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-12 gap-6">

                {/* Left: Chart + Market Cards */}
                <div className="col-span-12 lg:col-span-9 flex flex-col gap-6">

                    {/* Featured Market Card */}
                    {market && (
                        <div className="bg-surface/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                            <div className="flex justify-between items-start mb-4 z-10 relative">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="bg-danger/20 text-danger text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Live</span>
                                        <span className="text-white/40 text-xs">Market #{market.id}</span>
                                    </div>
                                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                                        {market.question}
                                    </h2>
                                </div>
                                <div className="text-right z-10">
                                    <div className="text-4xl font-mono font-bold text-success">{market.yesOdds?.toFixed(1)}%</div>
                                    <div className="text-xs text-success/80">Yes Probability</div>
                                </div>
                            </div>

                            {/* Chart */}
                            <div className="w-full h-[280px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={chartView === 'YES' ? "#00FF94" : "#FF4444"} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={chartView === 'YES' ? "#00FF94" : "#FF4444"} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis dataKey="time" stroke="rgba(255,255,255,0.2)" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="rgba(255,255,255,0.2)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0A0A0C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="price"
                                            stroke={chartView === 'YES' ? "#00FF94" : "#FF4444"}
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill="url(#colorPrice)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Stats Row */}
                            <div className="grid grid-cols-3 gap-4 mt-4">
                                <button
                                    onClick={() => setChartView('YES')}
                                    className={`bg-black/20 border rounded-xl p-3 flex items-center gap-3 transition-all ${chartView === 'YES' ? 'border-success/50 bg-success/5' : 'border-white/5 hover:bg-white/5'
                                        }`}
                                >
                                    <div className="p-2 bg-white/5 rounded-lg text-success">
                                        <Activity size={16} />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-white/40 text-[10px] uppercase tracking-wider">YES Pool</div>
                                        <div className="text-lg font-mono font-medium text-white">${parseFloat(market.yesPool || '0').toFixed(2)}</div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setChartView('NO')}
                                    className={`bg-black/20 border rounded-xl p-3 flex items-center gap-3 transition-all ${chartView === 'NO' ? 'border-danger/50 bg-danger/5' : 'border-white/5 hover:bg-white/5'
                                        }`}
                                >
                                    <div className="p-2 bg-white/5 rounded-lg text-danger">
                                        <Users size={16} />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-white/40 text-[10px] uppercase tracking-wider">NO Pool</div>
                                        <div className="text-lg font-mono font-medium text-white">${parseFloat(market.noPool || '0').toFixed(2)}</div>
                                    </div>
                                </button>

                                <div className="bg-black/20 border border-white/5 rounded-xl p-3 flex items-center gap-3">
                                    <div className="p-2 bg-white/5 rounded-lg text-primary">
                                        <DollarSign size={16} />
                                    </div>
                                    <div>
                                        <div className="text-white/40 text-[10px] uppercase tracking-wider">Volume</div>
                                        <div className="text-lg font-mono font-medium">${market.totalVolume || '0'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* All Markets Grid */}
                    <div>
                        <h3 className="text-sm font-bold text-white/60 mb-4 uppercase tracking-widest">All Markets</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {markets.map((m) => (
                                <button
                                    key={m.id}
                                    onClick={() => setSelectedMarketId(m.id)}
                                    className={`text-left p-4 rounded-xl backdrop-blur-md border transition-all duration-300 group
                                        ${selectedMarketId === m.id
                                            ? 'bg-primary/10 border-primary/50 shadow-[0_0_20px_rgba(0,224,255,0.15)]'
                                            : 'bg-surface/30 border-white/10 hover:bg-surface/50 hover:border-white/20'
                                        }`}
                                >
                                    {/* Selected Indicator */}
                                    {selectedMarketId === m.id && (
                                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_#00E0FF]" />
                                    )}

                                    <div className="flex justify-between items-start mb-3">
                                        <span className="text-[10px] text-white/40 font-mono">#{m.id}</span>
                                        <div className="flex items-center gap-1">
                                            <TrendingUp size={12} className={m.yesOdds >= 50 ? 'text-success' : 'text-danger'} />
                                            <span className={`text-sm font-mono font-bold ${m.yesOdds >= 50 ? 'text-success' : 'text-danger'}`}>
                                                {m.yesOdds?.toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>

                                    <h4 className="text-sm font-medium text-white mb-3 line-clamp-2 leading-tight">
                                        {m.question}
                                    </h4>

                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-white/30">Vol: ${m.totalVolume}</span>
                                        <div className="flex gap-2">
                                            <span className="text-success/70">Y: {parseFloat(m.yesShares || '0').toFixed(0)}</span>
                                            <span className="text-danger/70">N: {parseFloat(m.noShares || '0').toFixed(0)}</span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Panel: Trade Execution */}
                <div className="col-span-12 lg:col-span-3 bg-surface/30 backdrop-blur-sm border border-white/5 rounded-2xl p-6 flex flex-col h-fit lg:sticky lg:top-6">
                    <h3 className="text-sm font-bold text-white/60 mb-6 uppercase tracking-widest">Trade Execution</h3>

                    {market && (
                        <TradePanel
                            marketId={market.id}
                            currentPrice={market.yesOdds || 50}
                            question={market.question}
                            balance={balance}
                        />
                    )}

                    <div className="mt-auto pt-6 border-t border-white/5">
                        <h4 className="text-xs text-white/30 uppercase mb-4">Market Info</h4>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-white/40">YES Shares</span>
                                <span className="text-white font-mono">{parseFloat(market?.yesShares || '0').toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/40">NO Shares</span>
                                <span className="text-white font-mono">{parseFloat(market?.noShares || '0').toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between border-t border-white/5 pt-2">
                                <span className="text-white/40">Algorithm</span>
                                <span className="text-primary text-xs">LMSR</span>
                            </div>
                        </div>
                    </div>

                    {/* UMA Resolution Panel */}
                    {market && (
                        <div className="mt-6">
                            <ResolutionPanel
                                marketId={market.id}
                                question={market.question}
                                endTime={market.endTime}
                                resolved={market.resolved}
                            />
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}

// Trade Panel Component
function TradePanel({ marketId, currentPrice, question, balance }: { marketId: number; currentPrice: number, question: string, balance: string }) {
    const { isConnected, address } = useWallet();
    const [side, setSide] = useState<'YES' | 'NO'>('YES');
    const [amount, setAmount] = useState<string>('100'); // USDC amount to spend
    const [estimatedShares, setEstimatedShares] = useState<string>('0');
    const [loading, setLoading] = useState(false);

    // Wagmi contract write
    const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    // Modal State
    const [successData, setSuccessData] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [errorTitle, setErrorTitle] = useState("Error");

    // Calculate estimated shares based on USDC amount
    useEffect(() => {
        function calcShares() {
            if (!amount || parseFloat(amount) <= 0) {
                setEstimatedShares('0');
                return;
            }
            // Use current price to estimate shares
            // Price is in percentage (e.g., 50 = 50%)
            const priceDecimal = (side === 'YES' ? currentPrice : 100 - currentPrice) / 100;
            // Estimated shares = amount / price
            const shares = parseFloat(amount) / priceDecimal;
            setEstimatedShares(shares.toFixed(2));
        }
        calcShares();
    }, [amount, side, currentPrice]);

    const handleBuy = async () => {
        // Check for insufficient balance
        const cost = parseFloat(amount);
        const currentBalance = parseFloat(balance.replace(/,/g, ''));

        if (cost > currentBalance) {
            setErrorTitle("Insufficient Balance");
            setErrorMessage(`You need to deposit more funds.\n\nAmount: $${cost.toFixed(2)}\nDeposited Balance: $${currentBalance.toFixed(2)}\n\nGo to Deposit page to add funds.`);
            setIsErrorModalOpen(true);
            return;
        }

        setLoading(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL;

            if (apiUrl) {
                // Custodial trading via backend API (no wallet popup!)
                const response = await fetch(`${apiUrl}/api/bet`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        walletAddress: address,
                        marketId,
                        side,
                        shares: parseFloat(estimatedShares),
                        amount: parseFloat(amount)
                    })
                });

                const data = await response.json();

                if (data.success) {
                    setSuccessData({
                        marketId,
                        side,
                        shares: data.transaction?.shares || parseFloat(estimatedShares),
                        cost: data.transaction?.cost || parseFloat(amount),
                        hash: data.transaction?.hash,
                        question
                    });
                    setIsModalOpen(true);
                } else {
                    setErrorTitle("Trade Failed");
                    setErrorMessage(data.error || "Unknown error occurred");
                    setIsErrorModalOpen(true);
                }
            } else {
                // Direct contract call (requires wallet popup)
                const sharesInUnits = parseUnits(estimatedShares, 6);
                const maxCost = parseUnits(amount, 6);

                writeContract({
                    address: MARKET_CONTRACT,
                    abi: MARKET_ABI,
                    functionName: 'buyShares',
                    args: [BigInt(marketId), side === 'YES', sharesInUnits, maxCost],
                });

                // Show success (transaction will confirm in wallet)
                setSuccessData({
                    marketId,
                    side,
                    shares: parseFloat(estimatedShares),
                    cost: parseFloat(amount),
                    question
                });
                setIsModalOpen(true);
            }
        } catch (error: any) {
            console.error('Error placing bet:', error);
            setErrorTitle("Trade Error");
            setErrorMessage(error.message || "Failed to execute trade");
            setIsErrorModalOpen(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <SuccessModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    window.location.reload();
                }}
                data={successData || {}}
            />

            <AlertModal
                isOpen={isErrorModalOpen}
                onClose={() => setIsErrorModalOpen(false)}
                title={errorTitle}
                message={errorMessage}
                type="error"
            />

            {/* Yes/No Selector */}
            <div className="grid grid-cols-2 gap-2 mb-6">
                <button
                    onClick={() => setSide('YES')}
                    className={`font-bold py-3 rounded-lg transition-all ${side === 'YES'
                        ? 'bg-success text-black'
                        : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                        }`}
                >
                    BUY YES
                </button>
                <button
                    onClick={() => setSide('NO')}
                    className={`font-bold py-3 rounded-lg transition-all ${side === 'NO'
                        ? 'bg-danger text-black'
                        : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                        }`}
                >
                    BUY NO
                </button>
            </div>

            <div className="space-y-4 mb-6">
                <div>
                    <label className="text-xs text-white/40 block mb-2">Amount (USDC)</label>
                    <div className="relative">
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="100"
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white font-mono focus:outline-none focus:border-primary/50 transition-colors"
                        />
                        <span className="absolute right-3 top-3 text-white/30 text-xs">USDC</span>
                    </div>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-white/40">Est. Shares</span>
                    <span className="font-mono text-primary">{parseFloat(estimatedShares).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-white/40">Price per Share</span>
                    <span className="font-mono text-white/60">${(side === 'YES' ? currentPrice : 100 - currentPrice) / 100}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-white/40">Current {side} Price</span>
                    <span className={`font-mono ${side === 'YES' ? 'text-success' : 'text-danger'}`}>
                        {side === 'YES' ? currentPrice.toFixed(1) : (100 - currentPrice).toFixed(1)}%
                    </span>
                </div>
            </div>

            <SlideToConfirm
                onConfirm={handleBuy}
                isLoading={loading}
                disabled={loading || !amount || parseFloat(amount) <= 0}
                text={`SLIDE TO BUY ${side}`}
                side={side}
            />
        </>
    );
}
