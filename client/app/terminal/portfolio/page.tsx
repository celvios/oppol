"use client";

import { PieChart, TrendingUp, ArrowUpRight, ArrowDownRight, Wallet, Plus, Minus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from 'react';
import { web3Service } from '@/lib/web3';
import { useWallet } from "@/lib/use-wallet";
import { useEIP6963 } from "@/lib/useEIP6963";
import { WalletSelectorModal } from "@/components/ui/WalletSelectorModal";
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
    const [showWalletModal, setShowWalletModal] = useState(false);
    const [isCustodial, setIsCustodial] = useState(false);
    const [custodialAddress, setCustodialAddress] = useState<string | null>(null);

    // Wallet connection state
    const { isConnected, address } = useWallet();
    const {
        wallets,
        walletState,
        isConnecting,
        error,
        connect,
        connectMetaMaskSDK,
        isMobile,
    } = useEIP6963();

    // Check for Google login custodial user on mount
    useEffect(() => {
        const sessionToken = localStorage.getItem('session_token');
        const storedAddress = localStorage.getItem('wallet_address');
        const loginMethod = localStorage.getItem('login_method');
        if (sessionToken && storedAddress && loginMethod === 'google') {
            setIsCustodial(true);
            setCustodialAddress(storedAddress);
        }
    }, []);

    // Consider connected if either Wagmi, EIP-6963, or Google custodial
    const effectiveConnected = isConnected || walletState.isConnected || isCustodial;
    const effectiveAddress = address || walletState.address || custodialAddress;

    useEffect(() => {
        // Only fetch data if wallet is connected
        if (!effectiveAddress) {
            setLoading(false);
            return;
        }

        async function fetchData() {
            try {
                // Fetch user DEPOSITED balance (Polymarket-style)
                const userBalance = await web3Service.getDepositedBalance(effectiveAddress!);
                setBalance(userBalance);

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

                for (const market of markets) {
                    const position = await web3Service.getUserPosition(market.id, effectiveAddress!);
                    if (!position) continue;

                    const yesShares = parseFloat(position.yesShares) || 0;
                    const noShares = parseFloat(position.noShares) || 0;

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
    }, [effectiveAddress]);

    // WALLET CONNECTION GATE - Show connect prompt if not connected
    if (!effectiveConnected) {
        return (
            <>
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
                            onClick={() => setShowWalletModal(true)}
                            className="px-8 py-4 bg-primary hover:bg-primary/80 text-white font-bold rounded-xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(0,224,255,0.3)]"
                        >
                            Connect Wallet
                        </button>
                    </div>
                </div>

                <WalletSelectorModal
                    isOpen={showWalletModal}
                    onClose={() => setShowWalletModal(false)}
                    wallets={wallets}
                    onSelectWallet={async (wallet) => {
                        await connect(wallet);
                        setShowWalletModal(false);
                    }}
                    onConnectMetaMaskSDK={async () => {
                        await connectMetaMaskSDK();
                        setShowWalletModal(false);
                    }}
                    isConnecting={isConnecting}
                    error={error}
                    isMobile={isMobile}
                />
            </>
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

            {/* Fund Management Actions */}
            <div className="grid grid-cols-2 gap-4">
                <Link href="/terminal/deposit">
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
                <Link href="/terminal/withdraw">
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
