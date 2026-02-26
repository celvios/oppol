"use client";

import { PieChart, TrendingUp, Wallet, Plus, Minus, LogOut, Gift, Loader2, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from 'react';
import { web3Service } from '@/lib/web3';
import { useWallet } from "@/lib/use-wallet";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import EmptyPortfolioState from "@/components/wallet/EmptyPortfolioState";
import LogoBrand from "@/components/ui/LogoBrand";
import { usePrivy } from '@privy-io/react-auth';

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
    // Custodial wallet state (for social/embedded users)
    const [custodialAddress, setCustodialAddress] = useState<string | null>(null);
    const [custodialUsdcBalance, setCustodialUsdcBalance] = useState<string>('0');
    const [isDepositingCustodial, setIsDepositingCustodial] = useState(false);
    const [custodialDepositDone, setCustodialDepositDone] = useState(false);

    const { isConnected, isConnecting, address, connect, disconnect, loginMethod } = useWallet();
    const { user: privyUser } = usePrivy();
    const isEmbeddedWallet = loginMethod === 'privy' || loginMethod === 'google' || loginMethod === 'email';

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
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

                // For social/embedded users OR Web3 wallet users: resolve custodial/smart account address
                let checkAddress = effectiveAddress!;
                if (isEmbeddedWallet && privyUser?.id) {
                    try {
                        const authRes = await fetch(`${apiUrl}/api/auth/privy`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                privyUserId: privyUser.id,
                                walletAddress: effectiveAddress,
                                loginMethod: loginMethod || 'google'
                            })
                        });
                        const authData = await authRes.json();
                        const custAddr = authData.custodialAddress || authData.user?.wallet_address;
                        if (custAddr) {
                            setCustodialAddress(custAddr);
                            checkAddress = custAddr;
                            // Fetch custodial USDC balance in parallel below
                        }
                    } catch (e) {
                        console.warn('[Portfolio] Failed to fetch custodial address:', e);
                    }
                } else if (loginMethod === 'wallet') {
                    // MetaMask/connected wallet users deposit directly via EOA (approve+deposit).
                    // Their balance is stored as userBalances[EOA] in the market contract.
                    // No SA lookup needed — just use their EOA address.
                    console.log('[Portfolio] Wallet user — using EOA address for balance:', checkAddress);
                }

                // Kick off balance + portfolio fetch IN PARALLEL for speed
                const [depositedBalance, walletBal, portfolioRes] = await Promise.all([
                    web3Service.getDepositedBalance(checkAddress).catch(() => '0'),
                    web3Service.getUSDCBalance(effectiveAddress!).catch(() => '0'),
                    fetch(`${apiUrl}/api/portfolio/${checkAddress}`).then(r => r.json()).catch(() => ({ success: false, positions: [] })),
                ]);

                setBalance(depositedBalance);
                setWalletBalance(walletBal);

                // Custodial USDC/USDT balance (if needed)
                if (checkAddress !== effectiveAddress) {
                    try {
                        const { ethers } = await import('ethers');
                        const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed.binance.org/');
                        const usdcAddr = process.env.NEXT_PUBLIC_USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
                        const usdtAddr = process.env.NEXT_PUBLIC_USDT_CONTRACT || '0x55d398326f99059fF775485246999027B3197955';
                        const erc20Abi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
                        const usdc = new ethers.Contract(usdcAddr, erc20Abi, provider);
                        const usdt = new ethers.Contract(usdtAddr, erc20Abi, provider);

                        // Check both USDC and USDT (BSC-USD is essentially USDT)
                        const [rawUsdc, decUsdc, rawUsdt, decUsdt] = await Promise.all([
                            usdc.balanceOf(checkAddress), usdc.decimals().catch(() => 18),
                            usdt.balanceOf(checkAddress), usdt.decimals().catch(() => 18)
                        ]);

                        const usdcBal = parseFloat((await import('ethers')).ethers.formatUnits(rawUsdc, decUsdc));
                        const usdtBal = parseFloat((await import('ethers')).ethers.formatUnits(rawUsdt, decUsdt));

                        // Show whichever is higher (in case they deposited USDT and hasn't swept yet)
                        const maxBal = Math.max(usdcBal, usdtBal);
                        setCustodialUsdcBalance(maxBal.toFixed(6));
                    } catch (e) {
                        console.warn('[Portfolio] Custodial USDC/USDT balance fetch failed:', e);
                    }
                }

                // Map API positions to the Position interface
                const userPositions: Position[] = [];
                let aggregatePnL = 0;

                if (portfolioRes.success && Array.isArray(portfolioRes.positions)) {
                    for (const p of portfolioRes.positions) {
                        const pnl = p.pnl || 0;
                        aggregatePnL += pnl;
                        userPositions.push({
                            market: p.market,
                            marketId: p.marketId,
                            side: p.outcomeIndex === 0 ? 'YES' : 'NO',
                            shares: parseFloat((p.shares || 0).toFixed(2)),
                            avgPrice: (p.avgPrice || 0).toFixed(2),
                            currentPrice: p.currentPrice || 0,
                            currentValue: (p.currentValue || 0).toFixed(2),
                            pnl: p.pnlDisplay || '$0.00',
                            pnlRaw: pnl,
                            claimed: p.claimed || false,
                            isWinner: p.isWinner || false,
                            marketResolved: p.marketResolved || false,
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
                        onClick={() => disconnect()}
                        className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-xl hover:bg-red-500/20 transition-all text-red-400 hover:text-red-300"
                    >
                        <LogOut size={16} />
                        <span className="text-sm font-medium">Disconnect</span>
                    </button>
                </div>
            </div>

            {/* Custodial/Smart Deposit Prompt: for all users with USDC/USDT in their managed wallet */}
            {
                parseFloat(custodialUsdcBalance) > 0.01 && !custodialDepositDone && (
                    <div className="mb-8 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                <Wallet className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-lg font-bold text-white">Funds Ready to Play</h3>
                                    <span className="px-2 py-0.5 bg-green-500 text-black text-[10px] font-bold uppercase rounded-full">Detected</span>
                                </div>
                                <p className="text-white/60 text-sm">
                                    We found <span className="text-white font-mono font-bold">{parseFloat(custodialUsdcBalance).toFixed(2)} USDC/USDT</span> in your Smart Account.
                                    {loginMethod === 'wallet' && <span className="block text-white/40 text-xs mt-1">USDT will be swapped to USDC automatically.</span>}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={async () => {
                                if (!privyUser?.id) return;
                                setIsDepositingCustodial(true);
                                try {
                                    if (loginMethod === 'wallet') {
                                        // Web3 Wallet User: Requires Client-Side Gasless Transaction execution
                                        const { BiconomyService } = await import('@/lib/biconomy-service');
                                        const { ethers } = await import('ethers');

                                        const wallets = privyUser.linkedAccounts.filter(a => a.type === 'wallet') || [];
                                        const activeWallet = wallets.find((w: any) => w.address.toLowerCase() === address?.toLowerCase()) || wallets[0];
                                        if (!activeWallet) throw new Error("No active wallet found");

                                        // We might need to swap USDT first
                                        const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed.binance.org/');
                                        const usdtAddr = process.env.NEXT_PUBLIC_USDT_CONTRACT || '0x55d398326f99059fF775485246999027B3197955';
                                        const usdcAddr = process.env.NEXT_PUBLIC_USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
                                        const marketAddr = process.env.NEXT_PUBLIC_MARKET_ADDRESS || '';

                                        const usdt = new ethers.Contract(usdtAddr, ['function balanceOf(address) view returns (uint256)'], provider);
                                        const usdc = new ethers.Contract(usdcAddr, ['function balanceOf(address) view returns (uint256)'], provider);

                                        // Do we need to swap USDT?
                                        const usdtBal = await usdt.balanceOf(custodialAddress);
                                        if (usdtBal > ethers.parseUnits("0.01", 18)) {
                                            console.log('[Portfolio] Found USDT, initiating gasless swap...');
                                            await BiconomyService.executeSwap(activeWallet, usdtAddr, usdcAddr, usdtBal);
                                        }

                                        // Now deposit USDC
                                        const usdcBal = await usdc.balanceOf(custodialAddress);
                                        if (usdcBal > ethers.parseUnits("0.01", 18)) {
                                            console.log('[Portfolio] Depositing USDC into Market...');
                                            await BiconomyService.executeDeposit(activeWallet, marketAddr, usdcAddr, usdcBal);
                                        }

                                        setCustodialDepositDone(true);
                                        setTimeout(() => window.location.reload(), 3000);

                                    } else {
                                        // Embedded Wallet/Social User: Trigger backend relayer sweep
                                        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
                                        const res = await fetch(`${apiUrl}/api/wallet/deposit-custodial`, {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_SECRET || ''
                                            },
                                            body: JSON.stringify({ privyUserId: privyUser.id })
                                        });
                                        const data = await res.json();
                                        if (data.success) {
                                            if (data.txHash) console.log('Deposit TX:', data.txHash);
                                            setCustodialDepositDone(true);
                                            // Reload after a few seconds to show updated balance
                                            setTimeout(() => window.location.reload(), 5000);
                                        } else {
                                            alert(data.error || 'Deposit failed');
                                        }
                                    }
                                } catch (e: any) {
                                    alert('Deposit failed: ' + e.message);
                                } finally {
                                    setIsDepositingCustodial(false);
                                }
                            }}
                            disabled={isDepositingCustodial}
                            className="w-full md:w-auto px-6 py-3 bg-white hover:bg-white/90 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isDepositingCustodial ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                            ) : (
                                <>Add to Balance</>
                            )}
                        </button>
                    </div>
                )
            }
            {
                custodialDepositDone && (
                    <div className="mb-8 bg-green-500/10 border border-green-500/20 rounded-2xl p-6 flex items-center gap-4 animate-fadeIn">
                        <CheckCircle className="w-8 h-8 text-green-500 shrink-0" />
                        <div>
                            <h3 className="text-white font-bold">Deposit Submitted!</h3>
                            <p className="text-white/60 text-sm">Your balance will update in ~10 seconds. Refreshing...</p>
                        </div>
                    </div>
                )
            }

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
        </div >
    );
}
