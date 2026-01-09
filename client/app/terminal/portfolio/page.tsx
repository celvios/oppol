"use client";

import { PieChart, TrendingUp, ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react";
import { useEffect, useState } from 'react';
import { web3Service } from '@/lib/web3';
import { useWallet } from "@/lib/use-wallet";
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";

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
}

export default function PortfolioPage() {
    const [balance, setBalance] = useState<string>('0');
    const [positions, setPositions] = useState<Position[]>([]);
    const [totalPnL, setTotalPnL] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    // Wallet connection state
    const { isConnected, address } = useWallet();
    const { open } = useWeb3Modal();

    useEffect(() => {
        // Only fetch data if wallet is connected
        if (!isConnected || !address) {
            setLoading(false);
            return;
        }

        async function fetchData() {
            try {
                // Fetch user DEPOSITED balance (Polymarket-style)
                const userBalance = await web3Service.getDepositedBalance(address!);
                setBalance(userBalance);

                // Fetch all markets and user positions
                const markets = await web3Service.getMarkets();
                const userPositions: Position[] = [];
                let aggregatePnL = 0;

                for (const market of markets) {
                    const position = await web3Service.getUserPosition(market.id, address!);
                    if (!position) continue;

                    const yesShares = parseFloat(position.yesShares) || 0;
                    const noShares = parseFloat(position.noShares) || 0;

                    // Process YES position
                    if (yesShares > 0) {
                        const currentPrice = market.yesOdds / 100;
                        const avgPrice = 0.50;
                        const currentValue = yesShares * currentPrice;
                        const costBasis = yesShares * avgPrice;
                        const pnl = currentValue - costBasis;
                        aggregatePnL += pnl;

                        userPositions.push({
                            market: market.question,
                            marketId: market.id,
                            side: 'YES',
                            shares: Math.floor(yesShares),
                            avgPrice: avgPrice.toFixed(2),
                            currentPrice,
                            currentValue: currentValue.toFixed(2),
                            pnl: pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`,
                            pnlRaw: pnl,
                        });
                    }

                    // Process NO position
                    if (noShares > 0) {
                        const currentPrice = (100 - market.yesOdds) / 100;
                        const avgPrice = 0.50;
                        const currentValue = noShares * currentPrice;
                        const costBasis = noShares * avgPrice;
                        const pnl = currentValue - costBasis;
                        aggregatePnL += pnl;

                        userPositions.push({
                            market: market.question,
                            marketId: market.id,
                            side: 'NO',
                            shares: Math.floor(noShares),
                            avgPrice: avgPrice.toFixed(2),
                            currentPrice,
                            currentValue: currentValue.toFixed(2),
                            pnl: pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`,
                            pnlRaw: pnl,
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

        // Auto-refresh every 10 seconds
        const interval = setInterval(fetchData, 10000);

        // Cleanup on unmount
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
                        Connect your wallet to view your portfolio, positions, and trading history.
                    </p>
                    <button
                        onClick={() => open()}
                        className="px-8 py-4 bg-primary text-black font-bold rounded-xl hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(0,224,255,0.3)]"
                    >
                        Connect Wallet
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return <SkeletonLoader />;
    }

    const pnlDisplay = totalPnL >= 0
        ? `+$${totalPnL.toFixed(2)}`
        : `-$${Math.abs(totalPnL).toFixed(2)}`;

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-mono font-bold text-white mb-6">PORTFOLIO</h1>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface/40 border border-white/10 p-6 rounded-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><PieChart size={100} /></div>
                    <p className="text-white/40 text-sm uppercase tracking-widest mb-2">Total Balance</p>
                    <p className="text-4xl font-mono text-white">${parseFloat(balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <div className="mt-4 flex items-center gap-2 text-white/40 text-sm">
                        <TrendingUp size={16} />
                        <span>USDC Balance</span>
                    </div>
                </div>

                <div className="bg-surface/40 border border-white/10 p-6 rounded-2xl">
                    <p className="text-white/40 text-sm uppercase tracking-widest mb-2">Active Positions</p>
                    <p className="text-4xl font-mono text-white">{positions.length}</p>
                    <p className="text-white/30 text-xs mt-2">{positions.length > 0 ? `Across ${positions.length} Position${positions.length > 1 ? 's' : ''}` : 'No active positions'}</p>
                </div>

                <div className="bg-surface/40 border border-white/10 p-6 rounded-2xl">
                    <p className="text-white/40 text-sm uppercase tracking-widest mb-2">Unrealized PnL</p>
                    <p className={`text-4xl font-mono ${totalPnL >= 0 ? 'text-success' : 'text-danger'}`}>
                        {pnlDisplay}
                    </p>
                    <p className="text-white/30 text-xs mt-2">Based on 50% avg entry</p>
                </div>
            </div>

            {/* Positions Table */}
            <div className="bg-surface/30 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
                <div className="p-6 border-b border-white/5">
                    <h2 className="text-lg font-bold">Active Positions</h2>
                </div>
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-white/5 text-white/40 text-xs uppercase tracking-wider">
                            <th className="p-4 font-medium">Market</th>
                            <th className="p-4 font-medium">Side</th>
                            <th className="p-4 font-medium">Shares</th>
                            <th className="p-4 font-medium">Avg Price</th>
                            <th className="p-4 font-medium">Current Price</th>
                            <th className="p-4 font-medium">Value</th>
                            <th className="p-4 font-medium">PnL</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {positions.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-white/40">
                                    No active positions. Place a bet to get started!
                                </td>
                            </tr>
                        ) : (
                            positions.map((pos, i) => (
                                <tr key={i} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 font-medium text-white max-w-xs truncate">{pos.market}</td>
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
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Disclaimer */}
            <div className="text-center text-white/30 text-xs">
                Note: Average entry price is estimated at $0.50. For accurate PnL tracking, trade history logging will be implemented.
            </div>
        </div>
    );
}
