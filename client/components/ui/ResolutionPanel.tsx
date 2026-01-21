'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/lib/use-wallet';
import { useWriteContract, useReadContract } from 'wagmi';
import { ethers } from 'ethers'; // For parsing if needed
import { motion, AnimatePresence } from 'framer-motion';
import {
    Clock,
    CheckCircle,
    AlertTriangle,
    Gift,
    Loader2
} from 'lucide-react';
import { getContracts } from '@/lib/contracts';

// Get contract address
const contracts = getContracts() as any;
const MARKET_CONTRACT = (contracts.predictionMarketMulti || contracts.predictionMarket) as `0x${string}`;

// Market status enum
enum MarketStatus {
    ACTIVE = 'ACTIVE',
    ENDED = 'ENDED',
    ASSERTING = 'ASSERTING',
    DISPUTABLE = 'DISPUTABLE',
    RESOLVED = 'RESOLVED',
}

// Correct ABI for Multi-Market
const MARKET_ABI = [
    {
        name: 'assertOutcome',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'marketId', type: 'uint256' },
            { name: 'outcomeIndex', type: 'uint256' }
        ],
        outputs: [],
    },
    {
        name: 'settleMarket',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'marketId', type: 'uint256' }],
        outputs: [],
    },
    {
        name: 'claimWinnings',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'marketId', type: 'uint256' }],
        outputs: [],
    },
    {
        name: 'getUserPosition',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'marketId', type: 'uint256' },
            { name: 'user', type: 'address' }
        ],
        outputs: [
            { name: 'shares', type: 'uint256[]' },
            { name: 'claimed', type: 'bool' },
        ],
    },
] as const;

interface ResolutionPanelProps {
    marketId: number;
    question: string;
    endTime: number;
    resolved: boolean;
    outcome?: boolean; // Legacy prop (implies binary)
    winningOutcomeIndex?: number; // New prop for multi-outcome
    assertionPending?: boolean;
    assertedOutcome?: boolean; // Legacy
    assertedOutcomeIndex?: number; // New
    asserter?: string;
}

export function ResolutionPanel({
    marketId,
    question,
    endTime,
    resolved,
    outcome, // Legacy binary support
    winningOutcomeIndex,
    assertionPending = false,
    assertedOutcome,
    assertedOutcomeIndex,
    asserter
}: ResolutionPanelProps) {
    const { isConnected, address } = useWallet();
    const [status, setStatus] = useState<MarketStatus>(MarketStatus.ACTIVE);
    const [timeRemaining, setTimeRemaining] = useState('');
    const [actionInProgress, setActionInProgress] = useState<string | null>(null);

    // Contract write hooks
    const { writeContract: assertWrite, isPending: assertPendingWrite } = useWriteContract();
    const { writeContract: settleWrite, isPending: settlePending } = useWriteContract();
    const { writeContract: claimWrite, isPending: claimPending } = useWriteContract();

    // Read user position
    const { data: positionData } = useReadContract({
        address: MARKET_CONTRACT,
        abi: MARKET_ABI,
        functionName: 'getUserPosition',
        args: address ? [BigInt(marketId), address] : undefined,
        query: { enabled: !!address }
    });

    // Determine market status
    useEffect(() => {
        const now = Date.now() / 1000;

        if (resolved) {
            setStatus(MarketStatus.RESOLVED);
        } else if (assertionPending) {
            setStatus(MarketStatus.DISPUTABLE);
        } else if (now >= endTime) {
            setStatus(MarketStatus.ENDED);
        } else {
            setStatus(MarketStatus.ACTIVE);
        }
    }, [resolved, assertionPending, endTime]);

    // Update time remaining
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now() / 1000;
            const diff = endTime - now;

            if (diff <= 0) {
                setTimeRemaining('Ended');
            } else {
                const days = Math.floor(diff / 86400);
                const hours = Math.floor((diff % 86400) / 3600);
                const mins = Math.floor((diff % 3600) / 60);

                if (days > 0) {
                    setTimeRemaining(`${days}d ${hours}h`);
                } else if (hours > 0) {
                    setTimeRemaining(`${hours}h ${mins}m`);
                } else {
                    setTimeRemaining(`${mins}m`);
                }
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [endTime]);

    // Handle assert outcome (Binary Default: 0=Yes, 1=No ? Or 0=No, 1=Yes?)
    // Typically in this codebase: Yes=0, No=1 ??
    // Wait, let's look at `web3.ts`: const outcomeIndex = isYes ? 0 : 1;
    // So 0=YES, 1=NO.
    async function handleAssert(idx: number) {
        if (!isConnected) return;
        setActionInProgress('assert');

        try {
            assertWrite({
                address: MARKET_CONTRACT,
                abi: MARKET_ABI,
                functionName: 'assertOutcome',
                args: [BigInt(marketId), BigInt(idx)],
            });
        } catch (error) {
            console.error('Assert failed:', error);
            setActionInProgress(null);
        }
    }

    // Handle settle
    async function handleSettle() {
        if (!isConnected) return;
        setActionInProgress('settle');

        try {
            settleWrite({
                address: MARKET_CONTRACT,
                abi: MARKET_ABI,
                functionName: 'settleMarket',
                args: [BigInt(marketId)],
            });
        } catch (error) {
            console.error('Settle failed:', error);
            setActionInProgress(null);
        }
    }

    // Handle claim
    async function handleClaim() {
        if (!isConnected) return;
        setActionInProgress('claim');

        try {
            claimWrite({
                address: MARKET_CONTRACT,
                abi: MARKET_ABI,
                functionName: 'claimWinnings',
                args: [BigInt(marketId)],
            });
        } catch (error) {
            console.error('Claim failed:', error);
            setActionInProgress(null);
        }
    }

    // Parse user position
    // positionData is [shares[], claimed]
    const sharesArray = positionData ? (positionData as any)[0] : [];
    const hasClaimed = positionData ? (positionData as any)[1] : false;

    // For now assuming binary if we don't have outcome details
    // But sharesArray could have N items.
    // Try to safely access index 0 and 1.
    const userYesShares = sharesArray && sharesArray.length > 0 ? Number(sharesArray[0]) : 0; // Index 0 = YES?
    const userNoShares = sharesArray && sharesArray.length > 1 ? Number(sharesArray[1]) : 0;   // Index 1 = NO?

    // We assume standard binary mapping: 0=YES, 1=NO. Matches web3.ts
    // If it's multi, we just display "Winning Shares".

    // Determine winner for legacy binary props
    // If `winningOutcomeIndex` is provided, use it. Else infer from `outcome` bool.
    // `outcome` bool: true -> YES (0), false -> NO (1).
    const finalWinnerIndex = winningOutcomeIndex !== undefined
        ? winningOutcomeIndex
        : (outcome !== undefined ? (outcome ? 0 : 1) : null);

    const hasWinningPosition = resolved && finalWinnerIndex !== null && (
        (sharesArray && sharesArray[finalWinnerIndex] && Number(sharesArray[finalWinnerIndex]) > 0)
    );

    // Winning shares amount
    const winningSharesCount = hasWinningPosition && sharesArray ? Number(sharesArray[finalWinnerIndex!]) : 0;

    return (
        <div className="bg-surface/50 backdrop-blur-md border border-white/10 rounded-2xl p-6">
            {/* Status Header */}
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Resolution Status</h3>
                <StatusBadge status={status} />
            </div>

            {/* Status-specific content */}
            <AnimatePresence mode="wait">
                {/* ACTIVE - Market still running */}
                {status === MarketStatus.ACTIVE && (
                    <motion.div
                        key="active"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-center py-4"
                    >
                        <Clock className="w-12 h-12 text-white/30 mx-auto mb-3" />
                        <p className="text-white/60">Market ends in</p>
                        <p className="text-2xl font-mono font-bold text-white">{timeRemaining}</p>
                    </motion.div>
                )}

                {/* ENDED - Waiting for Admin Resolution */}
                {status === MarketStatus.ENDED && (
                    <motion.div
                        key="ended"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                    >
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                            <Clock className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                            <p className="text-amber-400 font-medium">Waiting for Resolution</p>
                            <p className="text-white/50 text-sm mt-1">
                                An admin will resolve this market shortly.
                            </p>
                        </div>
                    </motion.div>
                )}

                {/* RESOLVED - Market finalized */}
                {status === MarketStatus.RESOLVED && (
                    <motion.div
                        key="resolved"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                    >
                        <div className={`p-6 rounded-xl text-center ${finalWinnerIndex === 0 ? 'bg-green-500/20 border-green-500/30' : 'bg-red-500/20 border-red-500/30'
                            } border`}>
                            <CheckCircle className={`w-12 h-12 mx-auto mb-2 ${finalWinnerIndex === 0 ? 'text-green-400' : 'text-red-400'
                                }`} />
                            <p className="text-white/60 text-sm">Winning Outcome</p>
                            <p className={`text-3xl font-bold ${finalWinnerIndex === 0 ? 'text-green-400' : 'text-red-400'
                                }`}>
                                {finalWinnerIndex !== null && finalWinnerIndex !== undefined
                                    ? (finalWinnerIndex === 0 ? 'YES' : (finalWinnerIndex === 1 ? 'NO' : `Option ${finalWinnerIndex}`))
                                    : 'Pending'
                                }
                            </p>
                        </div>

                        {/* User position info */}
                        {sharesArray && sharesArray.some((s: bigint) => Number(s) > 0) && (
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="text-white/60 text-sm mb-2">Your Position</p>
                                <div className="flex flex-col gap-1">
                                    {sharesArray.map((share: bigint, idx: number) => {
                                        const s = Number(share);
                                        if (s <= 0) return null;
                                        return (
                                            <div key={idx} className="flex justify-between">
                                                <span className="text-white/70">
                                                    {idx === 0 ? 'YES' : (idx === 1 ? 'NO' : `Outcome ${idx}`)}
                                                </span>
                                                <span className="font-mono text-white">
                                                    {(s / 1e6).toFixed(2)} Shares
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Claim button */}
                        {hasWinningPosition && !hasClaimed && (
                            <button
                                onClick={handleClaim}
                                disabled={!isConnected || claimPending}
                                className="w-full py-4 bg-primary text-black font-bold rounded-xl hover:bg-primary/80 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {claimPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Gift className="w-5 h-5" />}
                                Claim {(winningSharesCount / 1e6).toFixed(2)} Winnings
                            </button>
                        )}

                        {hasClaimed && (
                            <div className="text-center py-4">
                                <CheckCircle className="w-8 h-8 text-primary mx-auto mb-2" />
                                <p className="text-primary font-medium">Winnings Claimed!</p>
                            </div>
                        )}

                        {!hasWinningPosition && !hasClaimed && sharesArray && sharesArray.some((s: bigint) => Number(s) > 0) && (
                            <div className="text-center py-4">
                                <AlertTriangle className="w-8 h-8 text-white/30 mx-auto mb-2" />
                                <p className="text-white/50">No winnings to claim</p>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Not connected warning */}
            {!isConnected && status !== MarketStatus.ACTIVE && (
                <p className="text-amber-400/80 text-sm text-center mt-4">
                    Connect wallet to interact
                </p>
            )}
        </div>
    );
}

// Status badge component
function StatusBadge({ status }: { status: MarketStatus }) {
    const config = {
        [MarketStatus.ACTIVE]: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/50', label: 'Active' },
        [MarketStatus.ENDED]: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/50', label: 'Awaiting Resolution' },
        [MarketStatus.ASSERTING]: { color: 'bg-purple-500/20 text-purple-400 border-purple-500/50', label: 'Asserting' },
        [MarketStatus.DISPUTABLE]: { color: 'bg-orange-500/20 text-orange-400 border-orange-500/50', label: 'Dispute Window' },
        [MarketStatus.RESOLVED]: { color: 'bg-green-500/20 text-green-400 border-green-500/50', label: 'Resolved' },
    };

    const { color, label } = config[status];

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${color}`}>
            {label}
        </span>
    );
}
