"use client";

import { PieChart, TrendingUp, Wallet, Plus, Minus, LogOut, Gift, Loader2, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from 'react';
import { web3Service } from '@/lib/web3';
import { useWallet } from "@/lib/use-wallet";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import EmptyPortfolioState from "@/components/wallet/EmptyPortfolioState";
import LogoBrand from "@/components/ui/LogoBrand";

interface Position {
    market: string;
    marketId: number;
    side: 'YES' | 'NO';
    shares: number;
    avgPrice: string;
    currentPrice: number;
    currentValue: string;
    pnl: string;
    pnlRaw: number;
    claimed: boolean;
    isWinner: boolean;
    marketResolved: boolean;
}

export default function PortfolioPage() {
    const [showWalletModal, setShowWalletModal] = useState(false);
    const [balance, setBalance] = useState<string>('0');
    const [walletBalance, setWalletBalance] = useState<string>('0');
    const [positions, setPositions] = useState<Position[]>([]);
    const [totalPnL, setTotalPnL] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [claimingMarketId, setClaimingMarketId] = useState<number | null>(null);

    const { isConnected, isConnecting, address, connect, disconnect } = useWallet();

    // Effective connection state (Standard OR Embedded)
    const isEffectivelyConnected = isConnected;



    const handleClaim = async (marketId: number) => {
        setClaimingMarketId(marketId);
        try {
            await web3Service.claimWinnings(marketId);
            alert('Winnings claimed successfully! The page will refresh to update your balances.');
            window.location.reload();
        } catch (e: any) {
            console.error(e);
            alert(`Claim failed: ${e.message || 'Unknown error'}`);
        } finally {
            setClaimingMarketId(null);
        }
    };

    useEffect(() => {
        // Reset loading state when wallet connection changes
        if (!isEffectivelyConnected && !isConnecting) {
            setLoading(false);
            setPositions([]);
            setBalance('0');
            setWalletBalance('0');
            setTotalPnL(0);
            return;
        }

        const effectiveAddress = address;

        // Only fetch data if we have an address (even if flags are transitioning)
        if (!effectiveAddress) {
            // If checking auth/wallet status, keep loading. 
            // If we are fully connected/ready but have no address, stop loading.
            if (!isConnecting) {
                setLoading(false);
            }
            return;
        }

        async function fetchData() {
            try {
                // Fetch user DEPOSITED balance (Polymarket-style)
                const userBalance = await web3Service.getDepositedBalance(effectiveAddress!);

                setBalance(userBalance);

                const getWalletBalance = await web3Service.getUSDCBalance(effectiveAddress!);
                setWalletBalance(getWalletBalance);

                // Fetch all markets and user positions
                const markets = await web3Service.getMarkets();

                // Fetch portfolio stats (real avg entry price) from backend
                let portfolioStats: Record<string, any> = {};
                try {
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
                    if (apiUrl) {
                        const statsRes = await fetch(`${apiUrl}/api/portfolio/${effectiveAddress}/stats`);
                        const statsData = await statsRes.json();
                        if (statsData.success) {
                            portfolioStats = statsData.stats;
                        }
                    }
                } catch (err) {
                    console.warn('Failed to fetch portfolio stats:', err);
                }

                const userPositions: Position[] = [];
                let aggregatePnL = 0;

                const positionPromises = markets.map(async (market) => {
                    const position = await web3Service.getUserPosition(market.id, effectiveAddress!);
                    return { market, position };
                });

                const results = await Promise.all(positionPromises);

                for (const { market, position } of results) {
                    if (!position) continue;

                    const yesShares = parseFloat(position.yesShares) || 0;
                    const noShares = parseFloat(position.noShares) || 0;
                    const claimed = position.claimed;
                    const marketResolved = market.resolved;
                    const winningOutcome = Number(market.winningOutcome);

                    // Process YES position
                    if (yesShares > 0) {
                        const currentPrice = market.yesOdds / 100;

                        // Get real avg price or fallback to 0.50
                        const statsKey = `${market.id}-YES`;
                        const avgPrice = portfolioStats[statsKey]?.avgPrice || 0.50;

                        const currentValue = yesShares * currentPrice;
                        const costBasis = yesShares * avgPrice;
                        const pnl = currentValue - costBasis;
                        aggregatePnL += pnl;

                        userPositions.push({
                            market: market.question,
                            marketId: market.id,
                            side: 'YES',
                            shares: parseFloat(yesShares.toFixed(2)),
                            avgPrice: avgPrice.toFixed(2),
                            currentPrice,
                            currentValue: currentValue.toFixed(2),
                            pnl: pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`,
                            pnlRaw: pnl,
                            claimed,
                            marketResolved,
                            isWinner: marketResolved && winningOutcome === 0,
                            winningOutcome
                        });
                    }

                    // Process NO position
                    if (noShares > 0) {
                        const currentPrice = (100 - market.yesOdds) / 100;

                        // Get real avg price or fallback to 0.50
                        const statsKey = `${market.id}-NO`;
                        const avgPrice = portfolioStats[statsKey]?.avgPrice || 0.50;

                        const currentValue = noShares * currentPrice;
                        const costBasis = noShares * avgPrice;
                        const pnl = currentValue - costBasis;
                        aggregatePnL += pnl;

                        userPositions.push({
                            market: market.question,
                            marketId: market.id,
                            side: 'NO',
                            shares: parseFloat(noShares.toFixed(2)),
                            avgPrice: avgPrice.toFixed(2),
                            currentPrice,
                            currentValue: currentValue.toFixed(2),
                            pnl: pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`,
                            pnlRaw: pnl,
                            claimed,
                            marketResolved,
                            isWinner: marketResolved && winningOutcome === 1,
                            winningOutcome
                        });
                    }
                }

                setPositions(userPositions);
                setTotalPnL(aggregatePnL);
            } catch (error) {
                console.error('Error fetching portfolio:', error);
            } finally {
                setLoading(false);
            }
        }

        // Initial fetch
        fetchData();

        // Auto-refresh every 60 seconds to reduce RPC usage
        const interval = setInterval(fetchData, 60000);

        // Cleanup on unmount
        return () => clearInterval(interval);
    }, [address, isConnecting, isEffectivelyConnected]);

    if (isConnecting) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <SkeletonLoader />
            </div>
        );
    }

    if (!isEffectivelyConnected) {
        return (
            <>
                <EmptyPortfolioState onConnect={connect} />
            </>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <SkeletonLoader />
            </div>
        );
    }



    const pnlDisplay = totalPnL >= 0
        ? `+$${totalPnL.toFixed(2)}`
        : `-$${Math.abs(totalPnL).toFixed(2)}`;

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-mono font-bold text-white">PORTFOLIO</h1>
                <div className="flex items-center gap-3">
                    {(address || isConnected) && (
                        <div className="text-xs text-white/40 bg-white/5 px-3 py-1 rounded-full">
                            🔗 Wallet Connected
                        </div>
                    )}
                    <button
                        onClick={async () => {
                            disconnect();
                            await logout();
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-xl hover:bg-red-500/20 transition-all text-red-400 hover:text-red-300"
                    >
                        <LogOut size={16} />
                        <span className="text-sm font-medium">Disconnect</span>
                    </button>
                </div>
            </div>

            import SmartDepositCard from "@/components/wallet/SmartDepositCard";

            // ...

            {/* Smart Deposit Prompt */}
            {parseFloat(walletBalance) > 0 && (
                <div className="mb-8">
                    <SmartDepositCard
                        walletBalance={walletBalance}
                        onDepositSuccess={() => {
                            // Simple reload to refresh balances
                            window.location.reload();
                        }}
                    />
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface/40 border border-white/10 p-6 rounded-2xl relative overflow-hidden">
                    <p className="text-white/40 text-sm uppercase tracking-widest mb-2">Deposited Balance</p>
                    <p className="text-4xl font-mono text-white">${parseFloat(balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <div className="mt-4 flex items-center gap-4 text-white/40 text-sm">
                        <div className="flex items-center gap-2">
                            <TrendingUp size={16} />
                            <span>Protocol</span>
                        </div>
                        <div className="h-4 w-[1px] bg-white/10"></div>
                        <div className="flex items-center gap-2 text-white/80">
                            <Wallet size={16} />
                            <span>Wallet: ${parseFloat(walletBalance).toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-surface/40 border border-white/10 p-6 rounded-2xl relative overflow-hidden">
                    <div className="absolute -right-4 top-0 opacity-[0.1] pointer-events-none">
                        <LogoBrand size="xl" />
                    </div>
                    <p className="text-white/40 text-sm uppercase tracking-widest mb-2">Active Positions</p>
                    <p className="text-4xl font-mono text-white">{positions.length}</p>
                    <p className="text-white/30 text-xs mt-2">{positions.length > 0 ? `Across ${positions.length} Position${positions.length > 1 ? 's' : ''}` : 'No active positions'}</p>
                </div>

                <div className="bg-surface/40 border border-white/10 p-6 rounded-2xl relative overflow-hidden">
                    <p className="text-white/40 text-sm uppercase tracking-widest mb-2">Unrealized PnL</p>
                    <p className={`text-4xl font-mono ${totalPnL >= 0 ? 'text-success' : 'text-danger'}`}>
                        {pnlDisplay}
                    </p>
                    <p className="text-white/30 text-xs mt-2">Based on trade history</p>
                </div>
            </div>

            {/* Fund Management Actions */}
            <div className="grid grid-cols-2 gap-4">
                <Link href="/deposit">
                    <button className="w-full p-4 bg-outcome-a/10 border border-outcome-a/30 rounded-xl hover:bg-outcome-a/20 transition-all group flex items-center justify-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-outcome-a/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Plus className="w-5 h-5 text-outcome-a" strokeWidth={3} />
                        </div>
                        <div className="text-left">
                            <div className="text-white font-bold">Deposit</div>
                            <div className="text-xs text-white/50">Add USDC</div>
                        </div>
                    </button>
                </Link>
                <Link href="/withdraw">
                    <button className="w-full p-4 bg-outcome-b/10 border border-outcome-b/30 rounded-xl hover:bg-outcome-b/20 transition-all group flex items-center justify-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-outcome-b/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Minus className="w-5 h-5 text-outcome-b" strokeWidth={3} />
                        </div>
                        <div className="text-left">
                            <div className="text-white font-bold">Withdraw</div>
                            <div className="text-xs text-white/50">Transfer out</div>
                        </div>
                    </button>
                </Link>
            </div>

            {/* Positions Table */}
            <div className="bg-surface/30 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
                <div className="p-6 border-b border-white/5">
                    <h2 className="text-lg font-bold">Active Positions</h2>
                </div>
                {/* Horizontal scroll container */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[800px]">
                        <thead>
                            <tr className="bg-white/5 text-white/40 text-xs uppercase tracking-wider">
                                <th className="p-4 font-medium">Market</th>
                                <th className="p-4 font-medium">Side</th>
                                <th className="p-4 font-medium">Shares</th>
                                <th className="p-4 font-medium">Avg Price</th>
                                <th className="p-4 font-medium">Current Price</th>
                                <th className="p-4 font-medium">Value</th>
                                <th className="p-4 font-medium">PnL</th>
                                <th className="p-4 font-medium text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {positions.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center">
                                        <div className="text-white/40 text-lg">
                                            No active positions. Place a bet to get started!
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                positions.map((pos, i) => (
                                    <tr key={i} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 font-medium text-white max-w-xs truncate">
                                            <Link href={`/markets?id=${pos.marketId}`} className="hover:text-neon-cyan transition-colors">
                                                {pos.market}
                                            </Link>
                                            {pos.marketResolved && (
                                                <div className="mt-1">
                                                    {pos.isWinner ? (
                                                        <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded uppercase font-bold">Won</span>
                                                    ) : (
                                                        <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded uppercase font-bold">Lost</span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className={pos.side === "YES" ? "text-success bg-success/10 px-2 py-1 rounded text-xs font-bold" : "text-danger bg-danger/10 px-2 py-1 rounded text-xs font-bold"}>
                                                {pos.side}
                                            </span>
                                        </td>
                                        <td className="p-4 font-mono text-white/80">{pos.shares}</td>
                                        <td className="p-4 font-mono text-white/60">${pos.avgPrice}</td>
                                        <td className="p-4 font-mono text-white/80">${pos.currentPrice.toFixed(2)}</td>
                                        <td className="p-4 font-mono text-white">${pos.currentValue}</td>
                                        <td className={`p-4 font-mono font-bold ${pos.pnlRaw >= 0 ? 'text-success' : 'text-danger'}`}>
                                            {pos.pnl}
                                        </td>
                                        <td className="p-4 text-right">
                                            {pos.marketResolved && pos.isWinner && !pos.claimed && (
                                                <button
                                                    onClick={() => handleClaim(pos.marketId)}
                                                    disabled={claimingMarketId === pos.marketId}
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500 text-black font-bold text-xs rounded hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                                                >
                                                    {claimingMarketId === pos.marketId ? (
                                                        <>
                                                            <Loader2 size={12} className="animate-spin" />
                                                            Claiming...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Gift size={12} />
                                                            Claim
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                            {pos.marketResolved && pos.isWinner && pos.claimed && (
                                                <span className="inline-flex items-center gap-1 text-xs text-green-400/50 font-mono">
                                                    <CheckCircle size={12} /> Claimed
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Disclaimer */}
            <div className="text-center text-white/30 text-xs">
                Note: Average entry price is estimated at $0.50. For accurate PnL tracking, trade history logging will be implemented.
            </div>
        </div>
    );
}
