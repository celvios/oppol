'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/lib/use-wallet';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Clock,
    CheckCircle,
    AlertTriangle,
    Gavel,
    Shield,
    Gift,
    Loader2,
    ExternalLink
} from 'lucide-react';
import { getContracts } from '@/lib/contracts';

// Get contract address from central config
const contracts = getContracts() as any;
const MARKET_CONTRACT = (contracts.predictionMarketLMSR || contracts.predictionMarket) as `0x${string}`;

// Market status enum
enum MarketStatus {
    ACTIVE = 'ACTIVE',
    ENDED = 'ENDED',
    ASSERTING = 'ASSERTING',
    DISPUTABLE = 'DISPUTABLE',
    RESOLVED = 'RESOLVED',
}

// Simple ABI for UMA market functions
const MARKET_ABI = [
    {
        name: 'assertOutcome',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'marketId', type: 'uint256' },
            { name: 'outcome', type: 'bool' }
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
        name: 'markets',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: '', type: 'uint256' }],
        outputs: [
            { name: 'question', type: 'string' },
            { name: 'endTime', type: 'uint256' },
            { name: 'yesShares', type: 'uint256' },
            { name: 'noShares', type: 'uint256' },
            { name: 'liquidityParam', type: 'uint256' },
            { name: 'resolved', type: 'bool' },
            { name: 'outcome', type: 'bool' },
            { name: 'subsidyPool', type: 'uint256' },
            { name: 'assertionId', type: 'bytes32' },
            { name: 'assertionPending', type: 'bool' },
            { name: 'asserter', type: 'address' },
            { name: 'assertedOutcome', type: 'bool' },
        ],
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
            { name: 'yesShares', type: 'uint256' },
            { name: 'noShares', type: 'uint256' },
            { name: 'claimed', type: 'bool' },
        ],
    },
] as const;

interface ResolutionPanelProps {
    marketId: number;
    question: string;
    endTime: number;
    resolved: boolean;
    outcome?: boolean;
    assertionPending?: boolean;
    assertedOutcome?: boolean;
    asserter?: string;
}

export function ResolutionPanel({
    marketId,
    question,
    endTime,
    resolved,
    outcome,
    assertionPending = false,
    assertedOutcome,
    asserter
}: ResolutionPanelProps) {
    const { isConnected, address } = useWallet();
    const [status, setStatus] = useState<MarketStatus>(MarketStatus.ACTIVE);
    const [timeRemaining, setTimeRemaining] = useState('');
    const [actionInProgress, setActionInProgress] = useState<string | null>(null);

    // Contract write hooks
    const { writeContract: assertWrite, data: assertHash, isPending: assertPending } = useWriteContract();
    const { writeContract: settleWrite, data: settleHash, isPending: settlePending } = useWriteContract();
    const { writeContract: claimWrite, data: claimHash, isPending: claimPending } = useWriteContract();

    // Read user position
    const { data: position } = useReadContract({
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

    // Handle assert outcome
    async function handleAssert(outcomeValue: boolean) {
        if (!isConnected) return;
        setActionInProgress('assert');

        try {
            assertWrite({
                address: MARKET_CONTRACT,
                abi: MARKET_ABI,
                functionName: 'assertOutcome',
                args: [BigInt(marketId), outcomeValue],
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

    // Check if user can claim
    const userYesShares = position ? Number(position[0]) : 0;
    const userNoShares = position ? Number(position[1]) : 0;
    const hasClaimed = position ? position[2] : false;
    const hasWinningPosition = resolved && (
        (outcome && userYesShares > 0) || (!outcome && userNoShares > 0)
    );

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

                {/* ENDED - Awaiting admin resolution */}
                {status === MarketStatus.ENDED && (
                    <motion.div
                        key="ended"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                    >
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                            <Gavel className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                            <p className="text-amber-400 font-medium">Awaiting Resolution</p>
                            <p className="text-white/50 text-sm mt-1">
                                This market has ended and is pending admin resolution.
                            </p>
                        </div>

                        <p className="text-white/60 text-sm text-center">{question}</p>

                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                            <Clock className="w-6 h-6 text-white/40 mx-auto mb-2" />
                            <p className="text-white/50 text-sm">
                                The outcome will be determined by the platform administrator.
                                Check back soon for resolution.
                            </p>
                        </div>
                    </motion.div>
                )}

                {/* DISPUTABLE - Assertion made, can be disputed */}
                {status === MarketStatus.DISPUTABLE && (
                    <motion.div
                        key="disputable"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                    >
                        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-white/60 text-sm">Asserted Outcome:</span>
                                <span className={`font-bold ${assertedOutcome ? 'text-green-400' : 'text-red-400'}`}>
                                    {assertedOutcome ? '✅ YES' : '❌ NO'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-white/60 text-sm">Asserted by:</span>
                                <span className="text-primary font-mono text-sm">
                                    {asserter?.slice(0, 6)}...{asserter?.slice(-4)}
                                </span>
                            </div>
                        </div>

                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                            <Shield className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                            <p className="text-amber-400 font-medium">Dispute Window Open</p>
                            <p className="text-white/50 text-sm mt-1">
                                ~2 hours for anyone to dispute this assertion
                            </p>
                        </div>

                        <button
                            onClick={handleSettle}
                            disabled={!isConnected || settlePending}
                            className="w-full py-3 bg-primary text-black font-bold rounded-xl hover:bg-primary/80 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {settlePending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Settle Market (After Liveness)
                        </button>

                        <p className="text-white/40 text-xs text-center">
                            Settlement can be called after the 2-hour liveness period
                        </p>
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
                        <div className={`p-6 rounded-xl text-center ${outcome
                            ? 'bg-green-500/20 border border-green-500/30'
                            : 'bg-red-500/20 border border-red-500/30'
                            }`}>
                            <CheckCircle className={`w-12 h-12 mx-auto mb-2 ${outcome ? 'text-green-400' : 'text-red-400'
                                }`} />
                            <p className="text-white/60 text-sm">Final Outcome</p>
                            <p className={`text-3xl font-bold ${outcome ? 'text-green-400' : 'text-red-400'
                                }`}>
                                {outcome ? 'YES' : 'NO'}
                            </p>
                        </div>

                        {/* User position info */}
                        {(userYesShares > 0 || userNoShares > 0) && (
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="text-white/60 text-sm mb-2">Your Position</p>
                                <div className="flex justify-between">
                                    {userYesShares > 0 && (
                                        <span className="text-green-400">
                                            {userYesShares.toLocaleString()} YES shares
                                        </span>
                                    )}
                                    {userNoShares > 0 && (
                                        <span className="text-red-400">
                                            {userNoShares.toLocaleString()} NO shares
                                        </span>
                                    )}
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
                                Claim Winnings
                            </button>
                        )}

                        {hasClaimed && (
                            <div className="text-center py-4">
                                <CheckCircle className="w-8 h-8 text-primary mx-auto mb-2" />
                                <p className="text-primary font-medium">Winnings Claimed!</p>
                            </div>
                        )}

                        {!hasWinningPosition && (userYesShares > 0 || userNoShares > 0) && (
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
