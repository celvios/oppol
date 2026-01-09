"use client";

import { ArrowDownRight, Wallet, CheckCircle, AlertCircle, Send } from "lucide-react";
import { useState, useEffect } from "react";
import { useWallet } from "@/lib/use-wallet";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { motion } from 'framer-motion';
import { getContracts } from "@/lib/contracts";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";

// Get contract addresses from config
const contracts = getContracts() as any;
const USDC_ADDRESS = (contracts.mockUSDC || '0x0eAD2Cc3B5eC12B69140410A1F4Dc8611994E6Be') as `0x${string}`;
const MARKET_CONTRACT = (contracts.predictionMarket || '0xEcB7195979Cb5781C2D6b4e97cD00b159922A6B3') as `0x${string}`;

// Simple Market ABI for balance check (we'll read from token directly)
const ERC20_ABI = [
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'transfer',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
] as const;

export default function WithdrawPage() {
    const { isConnected, address } = useWallet();
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawAddress, setWithdrawAddress] = useState('');
    const [step, setStep] = useState<'input' | 'confirm' | 'processing' | 'complete'>('input');
    const [custodialBalance, setCustodialBalance] = useState('0.00');
    const [loading, setLoading] = useState(true);

    // Read USDC balance for connected wallet
    const { data: usdcBalance } = useReadContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: { enabled: !!address }
    });

    // For custodial withdrawals - fetch balance from backend
    useEffect(() => {
        async function fetchBalance() {
            try {
                const sessionToken = localStorage.getItem('session_token');
                if (!sessionToken) {
                    setCustodialBalance('1000.00'); // Mock balance
                    setLoading(false);
                    return;
                }

                const payload = JSON.parse(atob(sessionToken.split('.')[1]));
                const userId = payload.userId;

                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/wallet/${userId}/balance`);
                const data = await response.json();

                if (data.success) {
                    setCustodialBalance(data.balance || '0.00');
                } else {
                    setCustodialBalance('1000.00'); // Mock for demo
                }
            } catch (error) {
                console.error('Error fetching balance:', error);
                setCustodialBalance('1000.00'); // Mock for demo
            } finally {
                setLoading(false);
            }
        }
        fetchBalance();
    }, []);

    const formattedUsdcBalance = usdcBalance
        ? parseFloat(formatUnits(usdcBalance, 6)).toFixed(2)
        : '0.00';

    // Handle custodial withdrawal request
    async function handleCustodialWithdraw() {
        if (!withdrawAmount || !withdrawAddress || parseFloat(withdrawAmount) <= 0) return;

        setStep('processing');

        try {
            const sessionToken = localStorage.getItem('session_token');
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/withdraw`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({
                    amount: withdrawAmount,
                    address: withdrawAddress
                })
            });

            const data = await response.json();

            if (data.success) {
                setStep('complete');
            } else {
                throw new Error(data.message || 'Withdrawal failed');
            }
        } catch (error) {
            console.error('Withdrawal error:', error);
            setStep('input');
            // Show error somehow
        }
    }

    // Validate BNB address
    const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);

    if (loading) {
        return <SkeletonLoader />;
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8 pt-8">
            <div className="text-center">
                <h1 className="text-3xl font-mono font-bold text-white mb-2">WITHDRAW FUNDS</h1>
                <p className="text-white/50">Withdraw USDC to any BNB Chain wallet</p>
            </div>

            {/* WalletConnect User - Direct Withdrawal */}
            {isConnected ? (
                <div className="bg-surface/50 backdrop-blur-md border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                <Wallet className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Your Wallet</h2>
                                <p className="text-sm text-white/50">{address?.slice(0, 8)}...{address?.slice(-6)}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-white/50">Available</p>
                            <p className="text-2xl font-mono font-bold text-primary">${formattedUsdcBalance}</p>
                        </div>
                    </div>

                    <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-center">
                        <p className="text-primary">
                            ✓ Your USDC is already in your wallet
                        </p>
                        <p className="text-white/50 text-sm mt-1">
                            No withdrawal needed - you have full control
                        </p>
                    </div>
                </div>
            ) : (
                /* Custodial User - Request Withdrawal */
                <div className="bg-surface/50 backdrop-blur-md border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-white">Withdraw USDC</h2>
                        <div className="text-right">
                            <p className="text-sm text-white/50">Balance</p>
                            <p className="text-xl font-mono font-bold text-primary">${custodialBalance}</p>
                        </div>
                    </div>

                    {step === 'input' && (
                        <div className="space-y-4">
                            {/* Amount */}
                            <div>
                                <label className="block text-sm font-medium text-white/60 mb-2">
                                    Amount
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={withdrawAmount}
                                        onChange={(e) => setWithdrawAmount(e.target.value)}
                                        placeholder="0.00"
                                        max={parseFloat(custodialBalance)}
                                        className="w-full px-4 py-4 bg-black/40 border border-white/10 rounded-xl text-white text-xl font-mono placeholder:text-white/20 focus:outline-none focus:border-primary/50"
                                    />
                                    <button
                                        onClick={() => setWithdrawAmount(custodialBalance)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-primary text-sm hover:underline"
                                    >
                                        MAX
                                    </button>
                                </div>
                            </div>

                            {/* Destination Address */}
                            <div>
                                <label className="block text-sm font-medium text-white/60 mb-2">
                                    Destination Address (BNB Chain)
                                </label>
                                <input
                                    type="text"
                                    value={withdrawAddress}
                                    onChange={(e) => setWithdrawAddress(e.target.value)}
                                    placeholder="0x..."
                                    className={`w-full px-4 py-4 bg-black/40 border rounded-xl text-white font-mono placeholder:text-white/20 focus:outline-none ${withdrawAddress && !isValidAddress(withdrawAddress)
                                        ? 'border-red-500/50'
                                        : 'border-white/10 focus:border-primary/50'
                                        }`}
                                />
                                {withdrawAddress && !isValidAddress(withdrawAddress) && (
                                    <p className="text-red-400 text-xs mt-1">Invalid BNB Chain address</p>
                                )}
                            </div>

                            <button
                                onClick={() => setStep('confirm')}
                                disabled={
                                    !withdrawAmount ||
                                    !withdrawAddress ||
                                    parseFloat(withdrawAmount) <= 0 ||
                                    parseFloat(withdrawAmount) > parseFloat(custodialBalance) ||
                                    !isValidAddress(withdrawAddress)
                                }
                                className="w-full py-4 bg-primary hover:bg-primary/80 disabled:bg-white/10 disabled:text-white/30 text-black font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                            >
                                Review Withdrawal
                                <ArrowDownRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}

                    {step === 'confirm' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-4"
                        >
                            <div className="bg-black/40 rounded-xl p-4 space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-white/50">Amount</span>
                                    <span className="text-white font-mono">${withdrawAmount} USDC</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-white/50">Network Fee</span>
                                    <span className="text-white font-mono">~$0.10</span>
                                </div>
                                <div className="border-t border-white/10 pt-3 flex justify-between">
                                    <span className="text-white/50">To Address</span>
                                    <span className="text-primary font-mono text-sm">
                                        {withdrawAddress.slice(0, 10)}...{withdrawAddress.slice(-8)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep('input')}
                                    className="flex-1 py-3 border border-white/20 text-white rounded-xl hover:bg-white/5 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCustodialWithdraw}
                                    className="flex-1 py-3 bg-primary text-black font-bold rounded-xl hover:bg-primary/80 transition-all flex items-center justify-center gap-2"
                                >
                                    <Send className="w-4 h-4" />
                                    Confirm
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {step === 'processing' && (
                        <div className="text-center py-8">
                            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-white">Processing withdrawal...</p>
                        </div>
                    )}

                    {step === 'complete' && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-8"
                        >
                            <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">Withdrawal Initiated!</h3>
                            <p className="text-white/50 mb-4">
                                ${withdrawAmount} USDC is being sent to your wallet
                            </p>
                            <p className="text-xs text-white/30">
                                Funds will arrive in ~5 minutes
                            </p>
                            <button
                                onClick={() => { setStep('input'); setWithdrawAmount(''); setWithdrawAddress(''); }}
                                className="mt-4 text-primary hover:underline"
                            >
                                Make another withdrawal
                            </button>
                        </motion.div>
                    )}
                </div>
            )}

            {/* Info Box */}
            <div className="bg-white/5 border border-white/10 p-6 rounded-xl">
                <h3 className="text-white font-bold mb-3">💡 About Withdrawals</h3>
                <ul className="list-disc list-inside text-sm text-white/60 space-y-2">
                    <li>Minimum withdrawal: $10 USDC</li>
                    <li>Network fee: ~$0.10 (deducted from amount)</li>
                    <li>Processing time: Usually under 5 minutes</li>
                    <li>Only BNB Chain (BSC) addresses supported</li>
                </ul>
            </div>
        </div>
    );
}
