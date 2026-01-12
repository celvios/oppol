'use client';

import { useState } from 'react';
import { useWallet } from '@/lib/use-wallet';
import { Shield, Plus, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function AdminPage() {
    const { isAdmin, isConnected, address, tokenBalance } = useWallet();
    const [question, setQuestion] = useState('');
    const [duration, setDuration] = useState('7'); // days
    const [liquidity, setLiquidity] = useState('1000');
    const [subsidy, setSubsidy] = useState('1000');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    // Not connected
    if (!isConnected) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-8">
                <div className="text-center">
                    <AlertTriangle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold mb-2">Wallet Not Connected</h1>
                    <p className="text-white/60 mb-6">Please connect your wallet to access admin features.</p>
                    <Link href="/terminal" className="text-primary hover:underline">
                        ← Go to Terminal
                    </Link>
                </div>
            </div>
        );
    }

    // Connected but not admin
    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-8">
                <div className="text-center max-w-md">
                    <Shield className="w-16 h-16 text-amber-400 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold mb-2">Admin Access Required</h1>
                    <p className="text-white/60 mb-4">
                        You need at least <span className="text-amber-400 font-bold">50,000,000 OPoll tokens</span> to access admin features.
                    </p>
                    <div className="bg-white/5 rounded-xl p-4 mb-6">
                        <p className="text-sm text-white/40">Your Balance</p>
                        <p className="text-xl font-mono text-white">{tokenBalance} OPoll</p>
                    </div>
                    <Link href="/terminal" className="text-primary hover:underline">
                        ← Go to Terminal
                    </Link>
                </div>
            </div>
        );
    }

    // Admin user
    async function handleCreateMarket(e: React.FormEvent) {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // TODO: Call smart contract to create market
            console.log('Creating market:', { question, duration, liquidity, subsidy });

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 2000));

            setSuccess(true);
            setQuestion('');
            setDuration('7');
            setLiquidity('1000');
            setSubsidy('1000');

            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            console.error('Error creating market:', error);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen bg-background p-8">
            {/* Header */}
            <div className="max-w-2xl mx-auto mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <Shield className="w-8 h-8 text-amber-400" />
                    <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
                </div>
                <p className="text-white/60">Create and manage prediction markets</p>
            </div>

            {/* Create Market Form */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto"
            >
                <div className="bg-surface/50 backdrop-blur-md border border-white/10 rounded-2xl p-6">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-primary" />
                        Create New Market
                    </h2>

                    <form onSubmit={handleCreateMarket} className="space-y-6">
                        {/* Question */}
                        <div>
                            <label className="block text-sm font-medium text-white/60 mb-2">
                                Market Question
                            </label>
                            <input
                                type="text"
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                placeholder="Will BTC reach $150k by end of 2026?"
                                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50"
                                required
                            />
                        </div>

                        {/* Duration */}
                        <div>
                            <label className="block text-sm font-medium text-white/60 mb-2">
                                Duration (Days)
                            </label>
                            <select
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary/50"
                            >
                                <option value="1">1 Day</option>
                                <option value="7">7 Days</option>
                                <option value="30">30 Days</option>
                                <option value="90">90 Days</option>
                                <option value="180">180 Days</option>
                                <option value="365">365 Days</option>
                            </select>
                        </div>

                        {/* Liquidity & Subsidy */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-white/60 mb-2">
                                    Liquidity Parameter
                                </label>
                                <input
                                    type="number"
                                    value={liquidity}
                                    onChange={(e) => setLiquidity(e.target.value)}
                                    placeholder="1000"
                                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50"
                                    required
                                    min="100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-white/60 mb-2">
                                    Initial Subsidy (USDC)
                                </label>
                                <input
                                    type="number"
                                    value={subsidy}
                                    onChange={(e) => setSubsidy(e.target.value)}
                                    placeholder="1000"
                                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50"
                                    required
                                    min="0"
                                />
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-4 bg-primary hover:bg-primary/80 disabled:bg-primary/50 text-black font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                    Creating Market...
                                </>
                            ) : (
                                <>
                                    <Plus className="w-5 h-5" />
                                    Create Market
                                </>
                            )}
                        </button>

                        {success && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-primary/20 border border-primary/50 rounded-xl p-4 text-center text-primary"
                            >
                                ✅ Market created successfully!
                            </motion.div>
                        )}
                    </form>
                </div>

                {/* Admin Info */}
                <div className="mt-6 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                    <p className="text-sm text-amber-400/80">
                        <strong>Admin Wallet:</strong> {address?.slice(0, 10)}...{address?.slice(-8)}
                    </p>
                    <p className="text-sm text-amber-400/60 mt-1">
                        Token Balance: {tokenBalance} OPoll
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
