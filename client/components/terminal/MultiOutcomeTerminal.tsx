"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { MultiOutcomeChart } from "./MultiOutcomeChart";
import { TrendingUp, Wallet, Clock, Activity, MessageCircle, Search, X, Share, Gift, Loader2, CheckCircle } from "lucide-react";
import html2canvas from "html2canvas";
import { useWallet } from "@/lib/use-wallet";
import { useWallets } from "@privy-io/react-auth";
import { BiconomyService } from '@/lib/biconomy-service';
import { getMultiContracts } from '@/lib/contracts-multi';
import { ethers } from "ethers";
import { web3MultiService, MultiMarket, MultiPosition } from '@/lib/web3-multi';
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import NeonSlider from "@/components/ui/NeonSlider";
import { SuccessModal } from "@/components/ui/SuccessModal";
import { ResolutionPanel } from "@/components/ui/ResolutionPanel";
import GlassCard from "@/components/ui/GlassCard";
import NeonButton from "@/components/ui/NeonButton";
import { ShareChartModal } from "@/components/ui/ShareChartModal";
import { InsufficientBalanceModal } from "@/components/modals/InsufficientBalanceModal";
import CommentsSection from "@/components/market/CommentsSection";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

import BoostButton from "@/components/market/BoostButton";
import DesktopFeaturedCarousel from "./DesktopFeaturedCarousel";
import FeaturedCarousel from "@/components/mobile/FeaturedCarousel";

// Outcome colors matching the chart component
const OUTCOME_COLORS = [
    "#27E8A7", // Neon Green
    "#00F0FF", // Neon Cyan
    "#FF2E63", // Neon Coral
    "#9D4EDD", // Neon Purple
    "#FFD700", // Gold
    "#FF8C00", // Orange
    "#0077B6", // Ocean Blue
    "#F72585", // Pink
];

interface PricePoint {
    time: string;
    [key: string]: number | string; // Dynamic keys for outcomes
}

interface TradeSuccessData {
    marketId: number;
    outcome: string;
    outcomeIndex: number;
    shares: number;
    cost: string;
    question: string;
    newPrice: number;
    hash: string;
}

interface MultiOutcomeTerminalProps {
    initialMarkets?: MultiMarket[];
}

export function MultiOutcomeTerminal({ initialMarkets = [] }: MultiOutcomeTerminalProps) {
    const searchParams = useSearchParams();
    const { wallets } = useWallets();

    // Use server-provided data if available (SSR = instant load!)
    const [markets, setMarkets] = useState<MultiMarket[]>(initialMarkets);
    const [selectedMarketId, setSelectedMarketId] = useState<number>(initialMarkets[0]?.id || 0);
    const [balance, setBalance] = useState<string>('0');
    const [loading, setLoading] = useState(initialMarkets.length === 0); // No loading if we have initial data!
    const [mounted, setMounted] = useState(false);
    const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null);
    const chartRef = useRef<HTMLDivElement>(null);
    const mobileChartRef = useRef<HTMLDivElement>(null);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [shareImageSrc, setShareImageSrc] = useState<string>("");
    const [userPosition, setUserPosition] = useState<MultiPosition | null>(null);
    const [isClaiming, setIsClaiming] = useState(false);

    const handleShareChart = async (isMobile = false) => {
        const ref = isMobile ? mobileChartRef : chartRef;
        console.log("handleShareChart called", { isMobile });
        if (!ref.current) {
            console.error("chartRef is null");
            return;
        }
        console.log("chartRef found, capturing...");

        // Open modal instantly with loading state
        setIsShareModalOpen(true);
        setShareImageSrc(""); // Clear previous image

        try {
            const canvas = await html2canvas(ref.current, {
                backgroundColor: '#020408', // Match background
                scale: 2, // Retina quality
                logging: false,
                useCORS: true // Handle images if any
            });

            canvas.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                setShareImageSrc(url);
            }, 'image/png');

        } catch (err) {
            console.error("Failed to capture chart:", err);
            setIsShareModalOpen(false);
        }
    };
    const [amount, setAmount] = useState(''); // Default to empty string for mobile UX
    const [isTradeLoading, setIsTradeLoading] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successData, setSuccessData] = useState<TradeSuccessData | null>(null);
    const [showConnectModal, setShowConnectModal] = useState(false);
    const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);

    // Ref for mobile input auto-focus
    const mobileInputRef = useRef<HTMLInputElement>(null);

    const [searchQuery, setSearchQuery] = useState("");

    // Pagination (Moved up to avoid conditional hook violation)
    const ITEMS_PER_PAGE = 10;
    const [currentPage, setCurrentPage] = useState(1);

    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    const [showInsufficientBalance, setShowInsufficientBalance] = useState(false);

    const market = markets.find(m => m.id === selectedMarketId) || markets[0];
    const marketRef = useRef(market);

    // Auto-focus and clear input on mobile when outcome is selected
    useEffect(() => {
        if (selectedOutcome !== null) {
            setAmount('');
            setTimeout(() => {
                if (mobileInputRef.current) mobileInputRef.current.focus();
            }, 100);
        }
    }, [selectedOutcome]);

    // Helper to validate image
    const isValidImage = (img: string | undefined): boolean => {
        if (!img || !img.trim()) return false;
        const trimmed = img.trim();
        return trimmed.startsWith('data:image/') ||
            trimmed.startsWith('http://') ||
            trimmed.startsWith('https://') ||
            trimmed.startsWith('/');
    };

    const getImageUrl = (m: MultiMarket) => {
        const img = m.image_url || m.image || '';
        return img && isValidImage(img) ? img.trim() : '';
    };

    const metadata = market ? {
        image: getImageUrl(market),
        description: market.description && market.description.trim() ? market.description.trim() : '',
        category: market.category_id || 'General'
    } : null;

    useEffect(() => {
        marketRef.current = market;
    }, [market]);

    useEffect(() => {
        setMounted(true);
    }, []);

    // --- Data Fetching ---
    const fetchHistory = useCallback(async (id: number) => {
        const generatePlaceholder = () => {
            if (!marketRef.current) return [];
            const now = Date.now();
            const m = marketRef.current;

            return Array.from({ length: 50 }).map((_, i) => {
                const time = new Date(now - (49 - i) * 1000).toLocaleTimeString();
                const point: any = { time };
                m.outcomes.forEach((outcome, idx) => {
                    const basePrice = m.prices[idx] || 0;
                    point[outcome] = basePrice + Math.sin((now - (49 - i) * 1000) / 800 + idx) * 0.5;
                });
                return point;
            });
        };

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL;
            if (apiUrl) {
                const response = await fetch(`${apiUrl}/api/markets/${id}/price-history?limit=50`);
                const data = await response.json();
                if (data.success && data.history?.length > 0) {
                    setPriceHistory(generatePlaceholder());
                } else {
                    setPriceHistory(generatePlaceholder());
                }
            } else {
                setPriceHistory(generatePlaceholder());
            }
        } catch (error) {
            console.error("Failed to fetch history:", error);
            setPriceHistory(generatePlaceholder());
        }
    }, []);

    // Animation / Heartbeat for chart
    useEffect(() => {
        const interval = setInterval(() => {
            if (!marketRef.current) return;
            const m = marketRef.current;
            setPriceHistory(prev => {
                const now = Date.now();
                const timeString = new Date(now).toLocaleTimeString();
                const newPoint: any = { time: timeString };
                m.outcomes.forEach((outcome, idx) => {
                    const basePrice = m.prices[idx] || 0;
                    newPoint[outcome] = basePrice + Math.sin(now / 800 + idx) * 0.5;
                });

                if (prev.length === 0) return [];
                const newHistory = [...prev, newPoint];
                return newHistory.slice(-50);
            });
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (selectedMarketId !== null && selectedMarketId !== undefined) fetchHistory(selectedMarketId);
    }, [selectedMarketId, fetchHistory]);

    const { isConnected, address, isConnecting: walletLoading, connect, loginMethod } = useWallet();

    // --- Data Fetching (Markets) ---
    const fetchData = useCallback(async () => {
        console.log('[MultiTerminal] fetchData called');
        try {
            const [allMarkets, depositedBalance, position] = await Promise.all([
                web3MultiService.getMarkets(),
                address ? web3MultiService.getDepositedBalance(address).catch(e => {
                    console.error('[MultiTerminal] Balance fetch error:', e);
                    return '0';
                }) : Promise.resolve('0'),
                (address && selectedMarketId !== null && selectedMarketId !== undefined) ? web3MultiService.getUserPosition(selectedMarketId, address).catch(e => {
                    console.error('[MultiTerminal] Position fetch error:', e);
                    return null;
                }) : Promise.resolve(null)
            ]);

            console.log('[MultiTerminal] Markets fetched:', allMarkets.length);
            setMarkets(allMarkets);
            setBalance(depositedBalance);
            if (position) setUserPosition(position);
        } catch (error) {
            console.error('[MultiTerminal] Error in fetchData:', error);
        } finally {
            setLoading(false);
        }
    }, [address, selectedMarketId]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 300000);
        return () => clearInterval(interval);
    }, [fetchData]);

    // Handle market selection (URL param > Default)
    useEffect(() => {
        if (markets.length === 0) return;

        const marketIdParam = searchParams.get('marketId');
        if (marketIdParam !== null) {
            const marketId = parseInt(marketIdParam, 10);
            if (!isNaN(marketId)) {
                const marketExists = markets.find(m => m.id === marketId);
                if (marketExists) {
                    setSelectedMarketId(marketId);
                    return;
                }
            }
        }

        if (selectedMarketId === undefined || selectedMarketId === null) {
            if (markets.length > 0) setSelectedMarketId(markets[0].id);
        }
    }, [searchParams, markets, selectedMarketId]);

    useEffect(() => {
        setSelectedOutcome(null);
    }, [selectedMarketId]);

    // --- Trading Logic ---

    const handleTrade = async () => {
        if (!isConnected) {
            connect();
            return;
        }

        if (selectedOutcome === null || !amount || parseFloat(amount) <= 0 || !market) return;

        // Balance check: all users go through Biconomy Smart Account now.
        // Balance represents the user's USDC in the market contract.
        // For both MetaMask and email users, trade amount must not exceed their deposited balance.
        if (parseFloat(amount) > parseFloat(balance)) {
            setShowInsufficientBalance(true);
            return;
        }

        setIsTradeLoading(true);

        try {
            let result;

            // ALL users — MetaMask, email, Google — go through Biconomy Smart Account.
            // First-time MetaMask users: Biconomy auto-deploys their Smart Account (1 signature, once ever).
            // All subsequent trades for everyone are completely popup-free.
            console.log(`[Terminal] Executing via Biconomy Smart Account (user type: ${loginMethod})...`);

            const contracts = getMultiContracts();
            const usdcDecimals = 18;
            const tradeAmountBN = ethers.parseUnits(amount, usdcDecimals);

            // Gas reimbursement: dynamically calculated from live BSC gas price + BNB/USD price.
            // Fetches real-time data and adds a 20% safety buffer. Falls back to $0.20 on error.
            const feeUSDC = await BiconomyService.estimateGasFeeUSDC();

            if (tradeAmountBN <= feeUSDC) {
                setIsTradeLoading(false);
                alert(`Trade amount is too small. It must be greater than the current network gas fee ($${ethers.formatUnits(feeUSDC, usdcDecimals)}).`);
                return;
            }

            // Net USDC that goes into the market contract for shares
            const netTradeCost = tradeAmountBN - feeUSDC;

            const currentPrice = market.prices[selectedOutcome];
            const priceFloat = currentPrice > 0 ? currentPrice / 100 : 0.5;

            // Calculate shares based on the NET amount, not the gross amount
            const netAmountFloat = parseFloat(ethers.formatUnits(netTradeCost, usdcDecimals));
            const estShares = netAmountFloat / priceFloat;
            const sharesBN = ethers.parseUnits(estShares.toFixed(18), 18);

            const activeWallet = wallets.find(w => w.address.toLowerCase() === address?.toLowerCase()) || wallets[0];
            if (!activeWallet) throw new Error("No active wallet found. Please reconnect.");

            const usdcAddr = (contracts as any).usdc || (contracts as any).mockUSDC;
            const treasury = process.env.NEXT_PUBLIC_TREASURY_ADDRESS || "0xa4B1B886f955b2342bC9bbB4f7B80839357378b76";

            const hash = await BiconomyService.executeBatchedTrade(
                activeWallet,
                contracts.predictionMarketMulti,
                usdcAddr,
                treasury,
                market.id,
                selectedOutcome,
                sharesBN,
                netTradeCost,  // USDC → market contract for shares
                feeUSDC        // USDC → treasury for gas reimbursement
            );

            result = {
                shares: estShares.toFixed(2),
                cost: amount,
                newPrice: currentPrice,
                hash: hash
            };

            setSuccessData({
                marketId: market.id,
                outcome: market.outcomes[selectedOutcome],
                outcomeIndex: selectedOutcome,
                shares: parseFloat(result.shares || '0'),
                cost: result.cost || amount,
                question: market.question,
                newPrice: result.newPrice || market.prices[selectedOutcome],
                hash: result.hash || '0x'
            });

            // Success Handing (Shared)
            setIsSuccessModalOpen(true);

            // Optimistic Update
            setMarkets(prev => prev.map(m => {
                if (m.id === market.id) {
                    const newPrices = [...m.prices];
                    if ((result as any).newPrice) newPrices[selectedOutcome] = (result as any).newPrice;

                    const newVol = parseFloat(m.totalVolume) + parseFloat(result.cost || amount);
                    return { ...m, totalVolume: newVol.toFixed(2), prices: newPrices };
                }
                return m;
            }));

            fetchData();

        } catch (e: any) {
            console.error("Trade failed:", e);
            const msg = e.message || 'Something went wrong';
            if (msg.includes('Insufficient balance') || msg.includes('transfer amount exceeds balance')) {
                setShowInsufficientBalance(true); // Re-use modal for external too?
                // Or alert
                if (loginMethod === 'wallet') alert("Insufficient USDC Balance in your wallet.");
            } else {
                alert(msg);
            }
        } finally {
            setIsTradeLoading(false);
        }
    };

    const handleClaim = async () => {
        if (!market || !address) return;
        setIsClaiming(true);
        try {
            const hash = await web3MultiService.claimWinnings(market.id);
            setSuccessData({
                marketId: market.id,
                outcome: 'Claim Winnings',
                outcomeIndex: -1,
                shares: 0,
                cost: '0',
                question: market.question,
                newPrice: 0,
                hash: hash
            });
            setIsSuccessModalOpen(true);
            fetchData(); // Refresh to update claimed status
        } catch (e: any) {
            console.error(e);
            alert(`Claim failed: ${e.message || 'Unknown error'}`);
        } finally {
            setIsClaiming(false);
        }
    };


    if (!mounted || walletLoading) {
        return <div className="p-10"><SkeletonLoader /></div>;
    }

    // Blocking wallet gate removed to allow browsing

    if (loading) return <div className="p-10"><SkeletonLoader /></div>;

    if (!market) {
        return (
            <div className="h-[calc(100vh-80px)] flex flex-col items-center justify-center text-white/50">
                <Activity size={64} className="mb-4 opacity-50" />
                <h2 className="text-2xl font-bold mb-2">No Active Markets</h2>
                <p>Check back later for new prediction markets.</p>
            </div>
        );
    }

    // Helper to get color for outcome
    const getOutcomeColor = (outcome: string | undefined, index: number) => {
        const lower = (outcome || '').toLowerCase();
        if (lower === 'yes') return '#27E8A7'; // Neon Green
        if (lower === 'no') return '#FF2E63';  // Neon Coral/Red
        return OUTCOME_COLORS[index % OUTCOME_COLORS.length];
    };

    // Build chart data showing all outcome prices
    const chartData = market.prices.map((price, i) => ({
        name: market.outcomes[i],
        price: price,
        color: getOutcomeColor(market.outcomes[i], i)
    }));

    const filteredMarkets = markets
        .filter(m => (m.question || '').toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => parseFloat(b.totalVolume) - parseFloat(a.totalVolume));

    const totalPages = Math.ceil(filteredMarkets.length / ITEMS_PER_PAGE);
    const paginatedMarkets = filteredMarkets.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    return (
        <>
            {/* MOBILE VIEW */}
            <div className="md:hidden min-h-screen relative pb-32 p-4 flex flex-col gap-4 max-w-[1800px] mx-auto overflow-y-auto">
                {successData && (
                    <SuccessModal
                        isOpen={isSuccessModalOpen}
                        onClose={() => {
                            setIsSuccessModalOpen(false);
                            fetchData();
                        }}
                        data={{
                            marketId: successData.marketId,
                            side: successData.outcome,
                            shares: successData.shares,
                            cost: successData.cost,
                            question: successData.question,
                            newPrice: successData.newPrice,
                            hash: successData.hash
                        }}
                    />
                )}

                {/* Featured Carousel (Mobile) */}
                <FeaturedCarousel markets={markets} />

                {/* Mobile Capture Container - Includes Header + Chart for sharing */}
                <div ref={mobileChartRef} className="flex flex-col gap-4">
                    {/* Market Header */}
                    <GlassCard className="p-4">
                        <div className="flex gap-2 mb-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono uppercase tracking-wider text-white/50">Market #{market.id}</span>
                            {!market.resolved && Date.now() / 1000 < market.endTime && (
                                <span className="px-2 py-0.5 rounded bg-neon-green/20 text-[10px] font-mono uppercase tracking-wider text-neon-green flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse" />
                                    LIVE
                                </span>
                            )}
                            {market.resolved && (
                                <span className="px-2 py-0.5 rounded bg-green-500/20 text-[10px] font-mono uppercase tracking-wider text-green-400">
                                    RESOLVED
                                </span>
                            )}
                            {!market.resolved && Date.now() / 1000 >= market.endTime && (
                                <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-[10px] font-mono uppercase tracking-wider text-yellow-400">
                                    ENDED
                                </span>
                            )}
                            <div className="ml-auto">
                                <BoostButton marketId={market.id} isBoosted={market.isBoosted} compact />
                            </div>
                        </div>
                        <h1 className="text-xl font-heading font-bold text-white mb-2">
                            {market.question}
                        </h1>
                        {metadata && metadata.description && (
                            <p className="text-white/60 text-xs mb-3 leading-relaxed">
                                {metadata.description}
                            </p>
                        )}
                        <div className="flex gap-4 text-xs text-text-secondary">
                            <div>Vol: ${market.totalVolume}</div>
                            <div>{market.outcomeCount} outcomes</div>
                            <div>{formatDistanceToNow(market.endTime * 1000)}</div>
                        </div>
                    </GlassCard>

                    {/* Chart */}
                    <GlassCard className="p-4">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-sm font-heading text-white">Chance Wave</h2>
                            <button
                                onClick={() => handleShareChart(true)}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors group/btn"
                                title="Share Chart"
                            >
                                <Share className="w-4 h-4 text-white/40 group-hover/btn:text-neon-cyan transition-colors" />
                            </button>
                        </div>
                        <div className="h-[200px] w-full">
                            <MultiOutcomeChart
                                data={priceHistory}
                                outcomes={market.outcomes || []}
                            />
                        </div>
                    </GlassCard>
                </div>
                {/* End Mobile Capture Container */}

                {/* Outcomes */}
                <GlassCard className="p-4 relative z-0">
                    <h3 className="text-sm font-heading text-white/70 mb-3">Outcomes</h3>


                    {(!market.outcomes || market.outcomes.length === 0) && (
                        <div className="text-white/50 text-center py-4 text-sm">
                            No outcomes found.
                        </div>
                    )}

                    {(market.outcomes || [])?.map((outcome, i) => {
                        // Safety check for prices
                        const price = (market.prices && market.prices[i]) ? market.prices[i] : 0;
                        const color = getOutcomeColor(outcome, i);
                        return (
                            <button
                                key={i}
                                onClick={() => setSelectedOutcome(i)}
                                className={`w-full p-3 rounded-lg border transition-all text-left ${selectedOutcome === i
                                    ? 'border-white/30 bg-white/10'
                                    : 'border-white/5 bg-white/5'
                                    }`}
                                disabled={market.resolved || Date.now() / 1000 >= market.endTime}
                            >
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                                        <span className="font-heading text-white text-sm">{outcome}</span>
                                    </div>
                                    <span className="text-lg font-mono font-bold" style={{ color: color }}>
                                        {(market.prices[i] || 0).toFixed(1)}%
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </GlassCard>

                {/* Trading Panel - Only if market is active */}
                {
                    selectedOutcome !== null && !market.resolved && Date.now() / 1000 < market.endTime && (
                        <div className="fixed bottom-20 left-0 right-0 p-4 bg-void/95 backdrop-blur-xl border-t border-white/10 z-40">
                            <div className="max-w-md mx-auto space-y-3">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="text-[10px] text-text-secondary uppercase">Amount</div>
                                        <input
                                            ref={mobileInputRef}
                                            type="number"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="bg-transparent w-24 text-white font-mono text-lg focus:outline-none"
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] text-text-secondary uppercase">Selected</div>
                                        <div className="text-sm font-heading text-white">{market.outcomes[selectedOutcome]}</div>
                                    </div>
                                </div>
                                {!isConnected ? (
                                    <NeonButton onClick={connect} variant="cyan" className="w-full py-3">
                                        CONNECT WALLET
                                    </NeonButton>
                                ) : (
                                    <NeonSlider
                                        onConfirm={handleTrade}
                                        isLoading={isTradeLoading}
                                        side={(market.outcomes[selectedOutcome] || 'OUTCOME').toUpperCase()}
                                        color={getOutcomeColor(market.outcomes[selectedOutcome], selectedOutcome)}
                                        disabled={!amount || parseFloat(amount) <= 0 || isTradeLoading}
                                    />
                                )}
                            </div>
                        </div>
                    )
                }

                {/* Resolution Status - Only if truly resolved */}
                {
                    market.resolved && market.winningOutcome < market.outcomeCount && (
                        <GlassCard className="p-4 space-y-4">
                            <div>
                                <h3 className="text-sm font-heading text-white mb-2">Resolution Status</h3>
                                <div className={`p-3 rounded-lg border flex items-center gap-3 ${userPosition?.shares[market.winningOutcome] && parseFloat(userPosition.shares[market.winningOutcome]) > 0 ? 'bg-green-500/10 border-green-500/20' : 'bg-white/5 border-white/10'}`}>
                                    {userPosition?.shares[market.winningOutcome] && parseFloat(userPosition.shares[market.winningOutcome]) > 0 ? (
                                        <div className="p-2 rounded-full bg-green-500/20 text-green-400">
                                            <Gift size={20} />
                                        </div>
                                    ) : (
                                        <div className="p-2 rounded-full bg-white/10 text-white/40">
                                            <CheckCircle size={20} />
                                        </div>
                                    )}
                                    <div>
                                        <div className="text-xs text-white/50 uppercase tracking-wide">Winning Outcome</div>
                                        <div className="text-lg font-heading text-white">
                                            {market.outcomes[market.winningOutcome]}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Claim Button for Winners */}
                            {userPosition && (
                                <>
                                    {parseFloat(userPosition.shares[market.winningOutcome] || '0') > 0 && !userPosition.claimed && (
                                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <NeonButton
                                                onClick={handleClaim}
                                                variant="green"
                                                className="w-full py-4 font-bold text-lg shadow-[0_0_30px_rgba(39,232,167,0.3)]"
                                                disabled={isClaiming}
                                            >
                                                {isClaiming ? (
                                                    <span className="flex items-center gap-2">
                                                        <Loader2 className="animate-spin" /> CLAIMING...
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-2">
                                                        <Gift /> CLAIM WINNINGS
                                                    </span>
                                                )}
                                            </NeonButton>
                                            <p className="text-center text-xs text-green-400/70 mt-3 font-mono">
                                                You won {parseFloat(userPosition.shares[market.winningOutcome]).toFixed(2)} shares!
                                            </p>
                                        </div>
                                    )}

                                    {userPosition.claimed && parseFloat(userPosition.shares[market.winningOutcome] || '0') > 0 && (
                                        <div className="text-center p-4 bg-white/5 rounded-xl border border-white/5">
                                            <div className="text-green-400 font-bold mb-1 flex items-center justify-center gap-2">
                                                <CheckCircle size={16} /> PAID OUT
                                            </div>
                                            <p className="text-xs text-white/40">Winnings have been sent to your wallet.</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </GlassCard>
                    )
                }

                <CommentsSection marketId={market.id} className="w-full" />
            </div >

            {/* DESKTOP VIEW */}
            < div className="hidden md:grid min-h-[calc(100vh-80px)] p-4 md:p-6 grid-cols-12 gap-6 w-full" >
                {successData && (
                    <SuccessModal
                        isOpen={isSuccessModalOpen}
                        onClose={() => {
                            setIsSuccessModalOpen(false);
                            fetchData();
                        }}
                        data={{
                            marketId: successData.marketId,
                            side: successData.outcome,
                            shares: successData.shares,
                            cost: successData.cost,
                            question: successData.question,
                            newPrice: successData.newPrice,
                            hash: successData.hash
                        }}
                    />
                )
                }

                {/* LEFT COLUMN: Market List (3 cols) */}
                <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">

                    {/* Featured Carousel (Desktop) */}
                    <DesktopFeaturedCarousel markets={markets} />

                    <GlassCard className="flex-none p-4 flex justify-between items-center bg-white/5 min-h-[60px]">
                        <div className="flex items-center w-full gap-3">
                            <div className="flex-1 flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/5 focus-within:border-white/20 transition-colors">
                                <Search size={14} className="text-white/50 flex-shrink-0" />
                                <input
                                    type="text"
                                    placeholder="Search markets..."
                                    className="bg-transparent border-none outline-none text-sm text-white placeholder:text-white/30 w-full font-mono"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery("")} className="hover:text-white text-white/50">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            <span className="text-xs bg-white/10 px-2 py-1.5 rounded text-white/50 whitespace-nowrap font-mono border border-white/5">
                                {filteredMarkets.length} ACTIVE
                            </span>
                        </div>
                    </GlassCard>


                    <div className="flex-1 space-y-3 pr-2 flex flex-col">
                        {paginatedMarkets.map((m) => {
                            if (!m.outcomes || !m.prices || m.outcomes.length === 0 || m.prices.length === 0) return null;
                            const maxPrice = Math.max(...m.prices);
                            const maxIndex = m.prices.indexOf(maxPrice);
                            const topOutcome = m.outcomes[maxIndex] || 'Unknown';
                            const topPrice = maxPrice || 0;
                            return (
                                <motion.button
                                    key={m.id}
                                    onClick={() => {
                                        setSelectedMarketId(m.id);
                                        const newUrl = new URL(window.location.href);
                                        newUrl.searchParams.set('marketId', String(m.id));
                                        window.history.pushState({}, '', newUrl.toString());
                                    }}
                                    className={`w-full text-left group relative p-4 rounded-xl border transition-all duration-300 ${selectedMarketId === m.id
                                        ? "bg-white/10 border-neon-green/50 shadow-[0_0_20px_rgba(39,232,167,0.1)]"
                                        : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20"
                                        }`}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <div className="flex gap-4 mb-3">
                                        {/* Market Image */}
                                        <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                            {(m.image_url || m.image) && isValidImage(m.image_url || m.image) ? (
                                                <img
                                                    src={(m.image_url || m.image || '').trim()}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        const target = e.currentTarget;
                                                        target.style.display = 'none';
                                                        const parent = target.parentElement;
                                                        if (parent) parent.classList.add('bg-neon-green/10');
                                                    }}
                                                />
                                            ) : null}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start gap-2">
                                                <h3 className={`font-heading text-sm leading-snug line-clamp-2 ${selectedMarketId === m.id ? "text-white" : "text-white/70"}`}>
                                                    {m.question}
                                                </h3>
                                                {selectedMarketId === m.id && (
                                                    <div className="w-1.5 h-1.5 bg-neon-green rounded-full shadow-[0_0_10px_#27E8A7] flex-shrink-0 mt-1" />
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between font-mono text-xs">
                                        <div className="flex gap-1 items-center">
                                            <span className="text-neon-cyan">{m.outcomeCount} outcomes</span>
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <span className="text-neon-green">{topOutcome}: {(() => {
                                                // Format: 50 -> "50", 49.9 -> "49.9"
                                                if (Math.abs(Math.round(topPrice) - topPrice) < 0.05) return Math.round(topPrice).toString();
                                                return topPrice.toFixed(1);
                                            })()}%</span>
                                        </div>
                                    </div>

                                    {/* Outcome mini-bars */}
                                    <div className="flex gap-0.5 mt-3 h-1.5 rounded overflow-hidden">
                                        {m.prices.map((price, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    width: `${price}%`,
                                                    backgroundColor: getOutcomeColor(m.outcomes[i], i),
                                                    minWidth: '2px'
                                                }}
                                            />
                                        ))}
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex justify-between items-center px-2 py-2 mt-auto">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className={`text-xs px-3 py-1.5 rounded-lg border ${currentPage === 1
                                    ? 'text-white/20 border-white/5 cursor-not-allowed'
                                    : 'text-white/70 border-white/10 hover:bg-white/10 hover:text-white'
                                    } transition-colors`}
                            >
                                Previous
                            </button>
                            <span className="text-xs text-white/40 font-mono">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className={`text-xs px-3 py-1.5 rounded-lg border ${currentPage === totalPages
                                    ? 'text-white/20 border-white/5 cursor-not-allowed'
                                    : 'text-white/70 border-white/10 hover:bg-white/10 hover:text-white'
                                    } transition-colors`}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>

                {/* CENTER COLUMN: Chart & Info (6 cols) */}
                <div className="col-span-12 lg:col-span-6 flex flex-col gap-6">

                    {/* Featured Carousel (Top of Market) */}
                    <DesktopFeaturedCarousel markets={markets} />

                    {/* Capture Container - Includes Header + Chart for sharing */}
                    <div ref={chartRef}>
                        {/* Header Info */}
                        <GlassCard className="p-6 relative overflow-hidden group mb-6">
                            {metadata && metadata.image && (
                                <div className="absolute top-0 right-0 h-full w-2/3 opacity-20 mask-image-linear-to-l pointer-events-none mix-blend-screen">
                                    <img
                                        src={metadata.image}
                                        alt=""
                                        className="h-full w-full object-cover object-center"
                                        onError={(e) => {
                                            const target = e.currentTarget;
                                            target.style.display = 'none';
                                            const parent = target.parentElement;
                                            if (parent) parent.style.display = 'none';
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-l from-transparent to-surface" />
                                </div>
                            )}

                            <div className="relative z-10">
                                <div className="flex gap-2 mb-2 flex-wrap">
                                    <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono uppercase tracking-wider text-white/50">Market #{market.id}</span>
                                    <span className="px-2 py-0.5 rounded bg-neon-green/20 text-[10px] font-mono uppercase tracking-wider text-neon-green">{market.outcomeCount} Outcomes</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${Date.now() > market.endTime * 1000
                                        ? 'bg-orange-500/20 text-orange-400'
                                        : 'bg-white/10 text-white/50'
                                        }`}>
                                        {Date.now() > market.endTime * 1000
                                            ? `Ended ${formatDistanceToNow(market.endTime * 1000)} ago`
                                            : `Ends in ${formatDistanceToNow(market.endTime * 1000)}`
                                        }
                                    </span>
                                    <div className="ml-auto">
                                        <BoostButton marketId={market.id} isBoosted={market.isBoosted} compact />
                                    </div>
                                </div>
                                <h1 className="text-2xl md:text-3xl font-heading font-bold text-white mb-2 max-w-2xl text-shadow-glow">
                                    {market.question}
                                </h1>
                                {metadata && (
                                    <p className="text-white/60 text-sm max-w-xl mb-4 leading-relaxed bg-black/20 p-2 rounded-lg backdrop-blur-sm border border-white/5">
                                        {metadata.description}
                                    </p>
                                )}

                                <div className="flex gap-8 items-end mt-4">
                                    <div>
                                        <div className="text-xs text-text-secondary uppercase tracking-widest mb-1">
                                            {selectedMarketId === market.id && selectedOutcome !== undefined && selectedOutcome !== null
                                                ? "Selected"
                                                : "Leading"}
                                        </div>
                                        <div className="text-3xl font-mono font-bold text-neon-green">
                                            {selectedMarketId === market.id && selectedOutcome !== undefined && selectedOutcome !== null
                                                ? market.outcomes[selectedOutcome]
                                                : market.outcomes[market.prices.indexOf(Math.max(...market.prices))]}
                                        </div>
                                        <div className="text-lg font-mono text-neon-green/70 flex items-baseline gap-2">
                                            {selectedMarketId === market.id && selectedOutcome !== undefined && selectedOutcome !== null
                                                ? (market.prices[selectedOutcome] || 0).toFixed(1)
                                                : Math.max(...market.prices).toFixed(1)}% <span className="text-xs text-white/50 font-sans">Chance</span>
                                        </div>
                                    </div>

                                    <div className="h-12 w-px bg-white/10" />

                                    <div>
                                        <div className="text-xs text-text-secondary uppercase tracking-widest mb-1">Volume</div>
                                        <div className="text-xl font-mono text-white">${market.totalVolume}</div>
                                    </div>

                                    <div className="h-12 w-px bg-white/10" />

                                    <div>
                                        <div className="text-xs text-text-secondary uppercase tracking-widest mb-1">Liquidity</div>
                                        <div className="text-xl font-mono text-white">${parseFloat(market.liquidityParam).toFixed(0)}</div>
                                    </div>
                                </div>
                            </div>
                        </GlassCard>

                        {/* Outcome Chance Chart & Bars */}
                        <GlassCard className="flex-1 min-h-[500px] p-6 flex flex-col relative overflow-hidden">
                            <div className="flex justify-between items-center mb-4 z-10 relative">
                                <h2 className="text-lg font-heading text-white">Chance Wave</h2>
                                <button
                                    onClick={() => handleShareChart(false)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors group/btn"
                                    title="Share Chart"
                                >
                                    <Share className="w-4 h-4 text-white/40 group-hover/btn:text-neon-cyan transition-colors" />
                                </button>
                            </div>

                            {/* Chart Section */}
                            <div className="h-[250px] w-full mb-6 border-b border-white/5 pb-6">
                                <MultiOutcomeChart
                                    data={priceHistory}
                                    outcomes={market.outcomes || []}
                                />
                            </div>

                            <div className="flex justify-between items-center mb-3 z-10 relative">
                                <h3 className="text-sm font-heading text-white/70">Outcome Distribution</h3>
                                <span className="text-xs text-white/50 font-mono">Click to select</span>
                            </div>

                            <div className="flex-1 flex flex-col gap-3 pr-2">
                                {market.outcomes && market.prices && market.outcomes.map((outcome, i) => {
                                    const color = getOutcomeColor(outcome, i);
                                    return (
                                        <motion.button
                                            key={i}
                                            onClick={() => setSelectedOutcome(i)}
                                            className={`relative p-4 rounded-xl border transition-all text-left ${selectedOutcome === i
                                                ? 'border-white/30 bg-white/10'
                                                : 'border-white/5 bg-white/5 hover:bg-white/10'
                                                }`}
                                            whileHover={{ scale: 1.01 }}
                                            whileTap={{ scale: 0.99 }}
                                        >
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-4 h-4 rounded-full"
                                                        style={{ backgroundColor: color }}
                                                    />
                                                    <span className="font-heading text-white font-medium">{outcome || 'Unknown'}</span>
                                                </div>
                                                <span
                                                    className="text-2xl font-mono font-bold"
                                                    style={{ color: color }}
                                                >
                                                    {(market.prices[i] || 0).toFixed(1)}%
                                                </span>
                                            </div>

                                            {/* Progress bar */}
                                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full rounded-full"
                                                    style={{ backgroundColor: color }}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${market.prices[i] || 0}%` }}
                                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                                />
                                            </div>

                                            {selectedOutcome === i && (
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                    <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_#fff]" />
                                                </div>
                                            )}
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </GlassCard>
                    </div>
                    {/* End Capture Container */}


                    {/* Comments Section (Inline) - Moved here to match width */}
                    <CommentsSection marketId={market.id} className="w-full" />
                </div>

                {/* RIGHT COLUMN: Trading Panel (3 cols) */}
                <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
                    <GlassCard className="flex-none p-4 bg-gradient-to-br from-white/5 to-transparent border-neon-cyan/20">
                        <div className="text-xs text-text-secondary uppercase tracking-widest mb-1">Available Balance</div>
                        <div className="text-2xl font-mono text-white flex items-center gap-2">
                            <span className="text-neon-cyan">$</span>
                            {parseFloat(balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            <NeonButton variant="glass" className="ml-auto text-xs py-1 h-auto" onClick={() => window.location.href = '/deposit'}>DEPOSIT</NeonButton>
                        </div>
                    </GlassCard>

                    <GlassCard className="p-4 flex flex-col gap-4 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-green via-neon-cyan to-neon-coral opacity-50" />

                        {/* Market Resolution or Trade Form */}
                        {((Date.now() / 1000) > (market.endTime || 0) || market.resolved || market.assertionPending) ? (
                            <div className="flex-none p-6 bg-white/5 border-t border-white/5">
                                <ResolutionPanel
                                    marketId={market.id}
                                    question={market.question}
                                    endTime={market.endTime}
                                    resolved={market.resolved}
                                    winningOutcomeIndex={market.winningOutcome}
                                    outcomes={market.outcomes}
                                    assertionPending={market.assertionPending}
                                    assertedOutcomeIndex={market.assertedOutcome}
                                    asserter={market.asserter}
                                />
                            </div>
                        ) : selectedOutcome === null ? (
                            <div className="flex flex-col items-center justify-center py-6 text-center text-white/40">
                                <p>Select an outcome to trade</p>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <h3 className="text-lg font-heading font-bold text-white mb-4">Place Trade</h3>

                                    {/* Selected Outcome Display */}
                                    <div className="p-4 rounded-xl border border-white/10 bg-white/5 mb-4">
                                        <div className="text-xs text-text-secondary uppercase tracking-widest mb-2">Selected Outcome</div>
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-4 h-4 rounded-full"
                                                style={{ backgroundColor: getOutcomeColor(market.outcomes[selectedOutcome], selectedOutcome) }}
                                            />
                                            <span className="font-heading text-white text-lg">{market.outcomes[selectedOutcome] || 'Unknown'}</span>
                                            <span
                                                className="ml-auto font-mono text-xl font-bold"
                                                style={{ color: getOutcomeColor(market.outcomes[selectedOutcome], selectedOutcome) }}
                                            >
                                                {(market.prices[selectedOutcome] || 0).toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs text-text-secondary uppercase tracking-widest mb-2 block">Amount (USDC)</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={amount}
                                                    onChange={(e) => setAmount(e.target.value)}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-mono text-lg focus:outline-none focus:border-neon-cyan/50 focus:shadow-[0_0_20px_rgba(0,240,255,0.1)] transition-all"
                                                    placeholder="0.00"
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
                                                    {['10', '50', '100'].map(val => (
                                                        <button
                                                            key={val}
                                                            onClick={() => setAmount(val)}
                                                            className="px-2 py-1 bg-white/10 rounded text-xs text-white/70 hover:bg-white/20 hover:text-white"
                                                        >
                                                            ${val}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-white/5 rounded-xl space-y-2 border border-white/5">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-text-secondary">Price</span>
                                                <span className="font-mono text-white">{(market.prices[selectedOutcome] || 0).toFixed(1)}¢</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-text-secondary">Est. Shares</span>
                                                <span className="font-mono text-neon-cyan">
                                                    {(() => {
                                                        const amt = parseFloat(amount || '0');
                                                        const price = (market.prices[selectedOutcome] || 0) / 100;
                                                        if (amt === 0 || price === 0) return '0';
                                                        return `~${(amt / price).toFixed(0)}`;
                                                    })()}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-sm border-t border-white/10 pt-2 mt-2">
                                                <span className="text-text-secondary">Max Spend</span>
                                                <span className="font-mono text-white">${parseFloat(amount || '0').toFixed(2)}</span>
                                            </div>
                                        </div>

                                        {/* Slider (Moved inside) */}
                                        <div className="pt-2">
                                            {!isConnected ? (
                                                <NeonButton
                                                    onClick={() => setShowConnectModal(true)}
                                                    variant="cyan"
                                                    className="w-full py-4"
                                                >
                                                    CONNECT WALLET TO TRADE
                                                </NeonButton>
                                            ) : (
                                                <NeonSlider
                                                    onConfirm={handleTrade}
                                                    isLoading={isTradeLoading}
                                                    side={(market.outcomes[selectedOutcome] || 'OUTCOME').toUpperCase()}
                                                    color={getOutcomeColor(market.outcomes[selectedOutcome], selectedOutcome)}
                                                    disabled={!amount || parseFloat(amount) < 0.5 || parseFloat(balance) === 0 || isTradeLoading}
                                                />
                                            )}
                                        </div>

                                        {/* Chance Distribution (Moved inside) */}
                                        <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                            <h4 className="text-xs text-text-secondary uppercase tracking-widest mb-3">Chance Distribution</h4>
                                            <div className="flex items-end gap-1 h-16">
                                                {market.prices.map((price, i) => {
                                                    const color = getOutcomeColor(market.outcomes[i], i);
                                                    return (
                                                        <div
                                                            key={i}
                                                            className="flex-1 rounded-t relative group overflow-hidden cursor-pointer"
                                                            style={{
                                                                height: `${Math.max(price, 5)}%`,
                                                                backgroundColor: `${color}40`
                                                            }}
                                                            onClick={() => setSelectedOutcome(i)}
                                                        >
                                                            <div
                                                                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                style={{ backgroundColor: color }}
                                                            />
                                                            {selectedOutcome === i && (
                                                                <div
                                                                    className="absolute inset-0"
                                                                    style={{ backgroundColor: color }}
                                                                />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="flex gap-1 mt-2">
                                                {market.outcomes.map((outcome, i) => (
                                                    <div key={i} className="flex-1 text-center">
                                                        <div className="text-[8px] text-white/40 truncate">{outcome}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>


                                </div>


                            </>
                        )}
                    </GlassCard>


                </div>
            </div >



            {/* Share Modal */}
            < ShareChartModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                imageSrc={shareImageSrc}
                marketQuestion={market.question}
                marketId={market.id}
            />

            {/* Insufficient Balance Modal */}
            <InsufficientBalanceModal
                isOpen={showInsufficientBalance}
                onClose={() => setShowInsufficientBalance(false)}
                needed={amount}
                balance={balance}
            />
        </>
    );
}
