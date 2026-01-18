"use client";

import { ArrowDownRight, Wallet, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useWallet } from "@/lib/use-wallet";
import { motion } from 'framer-motion';
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { SlideToConfirm } from "@/components/ui/SlideToConfirm";
import { getContracts } from '@/lib/contracts';
import { Contract, ethers } from 'ethers';
import ConnectWalletModal from "@/components/wallet/ConnectWalletModal";

const MARKET_ABI = [
    { name: 'userBalances', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
];

export default function WithdrawPage() {
    const { isConnected, address, connect } = useWallet();
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [step, setStep] = useState<'input' | 'confirm' | 'processing' | 'complete' | 'error'>('input');
    const [txHash, setTxHash] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [depositedBalance, setDepositedBalance] = useState('0.00');
    const [isBalanceLoading, setIsBalanceLoading] = useState(true);
    const [showConnectModal, setShowConnectModal] = useState(false);

    const contracts = getContracts() as any;
    const MARKET_CONTRACT = contracts.predictionMarket as `0x${string}`;

    useEffect(() => {
        if (address) {
            fetchBalance();
        }
    }, [address]);

    async function fetchBalance() {
        if (!address) return;
        setIsBalanceLoading(true);
        try {
            if (!window.ethereum) {
                setDepositedBalance('0.00');
                return;
            }

            const provider = new ethers.BrowserProvider(window.ethereum);
            const marketContract = new Contract(MARKET_CONTRACT, MARKET_ABI, provider);

            const balance = await marketContract.userBalances(address);
            const formattedBalance = ethers.formatUnits(balance, 6); // USDC has 6 decimals
            setDepositedBalance(parseFloat(formattedBalance).toFixed(2));
        } catch (error: any) {
            console.error('Failed to fetch balance:', error);
            setDepositedBalance('0.00');
        } finally {
            setIsBalanceLoading(false);
        }
    }

    async function handleWithdraw() {
        if (!address || !withdrawAmount || parseFloat(withdrawAmount) <= 0) return;
        setStep('processing');
        setErrorMessage('');
        try {
            if (!window.ethereum) {
                throw new Error('Please install MetaMask');
            }

            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const marketContract = new Contract(MARKET_CONTRACT, MARKET_ABI, signer);

            const amountInWei = ethers.parseUnits(withdrawAmount, 6); // USDC has 6 decimals

            console.log('Withdrawing from market contract...');
            const withdrawTx = await marketContract.withdraw(amountInWei);

            console.log('Transaction sent, waiting for confirmation...');
            const receipt = await withdrawTx.wait();

            console.log('Withdrawal successful!');
            setTxHash(receipt.hash);
            setStep('complete');

            // Refresh balance after successful withdrawal
            setTimeout(() => {
                fetchBalance();
            }, 2000);

        } catch (error: any) {
            console.error('Withdrawal failed:', error);
            let errorMessage = 'Withdrawal failed';

            if (error.code === 'ACTION_REJECTED') {
                errorMessage = 'Transaction was rejected by user';
            } else if (error.message?.includes('insufficient funds')) {
                errorMessage = 'Insufficient balance for withdrawal';
            } else if (error.message?.includes('exceeds balance')) {
                errorMessage = 'Amount exceeds available balance';
            } else if (error.message) {
                errorMessage = error.message;
            }

            setErrorMessage(errorMessage);
            setStep('error');
        }
    }

    // Determine loading state
    const formattedBalance = parseFloat(depositedBalance).toFixed(2);

    if (!isConnected) {
        return (
            <div className="max-w-2xl mx-auto pt-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-mono font-bold text-white mb-2">WITHDRAW FUNDS</h1>
                    <p className="text-white/50">Connect your wallet to withdraw your funds</p>
                </div>
                <>
                    <div className="bg-surface/50 backdrop-blur-md border border-white/10 rounded-2xl p-8 text-center">
                        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/20 flex items-center justify-center">
                            <Wallet className="w-8 h-8 text-primary" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-3">Withdraw Funds</h2>
                        <p className="text-white/50 mb-6">Connect your wallet to view your balance and withdraw funds.</p>
                        <button
                            onClick={() => setShowConnectModal(true)}
                            className="px-8 py-4 bg-primary text-black font-bold rounded-xl hover:bg-primary/90 transition-all"
                        >
                            Connect Wallet
                        </button>
                    </div>

                    <ConnectWalletModal
                        isOpen={showConnectModal}
                        onClose={() => setShowConnectModal(false)}
                        onConnect={connect}
                        context="withdraw"
                    />
                </>
            </div>
        );
    }

    if (isBalanceLoading && !depositedBalance) {
        return <SkeletonLoader />;
    }

    const availableBalance = parseFloat(depositedBalance);
    const canWithdraw = availableBalance > 0;

    return (
        <div className="max-w-2xl mx-auto space-y-8 pt-8 pb-24">
            <div className="text-center">
                <h1 className="text-3xl font-mono font-bold text-white mb-2">WITHDRAW FUNDS</h1>
                <p className="text-white/50">Withdraw your deposited balance back to your wallet</p>
            </div>

            {/* Balance Card */}
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
                        <p className="text-sm text-white/50">Available to Withdraw</p>
                        <p className="text-2xl font-mono font-bold text-primary">${formattedBalance}</p>
                    </div>
                </div>

                {/* No balance message */}
                {!canWithdraw && step === 'input' && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                        <p className="text-white/60">No funds available to withdraw.</p>
                        <p className="text-white/40 text-sm mt-1">Deposit funds first to start trading.</p>
                    </div>
                )}

                {/* Input Step */}
                {canWithdraw && step === 'input' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-white/60 mb-2">Amount to Withdraw</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    placeholder="0.00"
                                    max={availableBalance}
                                    className="w-full px-4 py-4 bg-black/40 border border-white/10 rounded-xl text-white text-xl font-mono placeholder:text-white/20 focus:outline-none focus:border-primary/50"
                                />
                                <button
                                    onClick={() => setWithdrawAmount(depositedBalance)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-primary text-sm hover:underline"
                                >
                                    MAX
                                </button>
                            </div>
                            {parseFloat(withdrawAmount) > availableBalance && (
                                <p className="text-red-400 text-xs mt-1">Amount exceeds available balance</p>
                            )}
                        </div>

                        <div className="bg-black/20 rounded-xl p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-white/50">Withdraw to</span>
                                <span className="text-white font-mono text-xs">{address?.slice(0, 10)}...{address?.slice(-8)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-white/50">Network</span>
                                <span className="text-white">BNB Smart Chain</span>
                            </div>
                        </div>

                        <button
                            onClick={() => setStep('confirm')}
                            disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > availableBalance}
                            className="w-full py-4 bg-red-500 hover:bg-red-400 disabled:bg-white/10 disabled:text-white/30 text-white font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
                        >
                            Review Withdrawal
                            <ArrowDownRight className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Confirm Step */}
                {step === 'confirm' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                        <div className="bg-black/40 rounded-xl p-4 space-y-3">
                            <div className="flex justify-between">
                                <span className="text-white/50">Amount</span>
                                <span className="text-white font-mono text-lg">${withdrawAmount} USDC</span>
                            </div>
                            <div className="border-t border-white/10 pt-3 flex justify-between">
                                <span className="text-white/50">To Wallet</span>
                                <span className="text-primary font-mono text-sm">{address?.slice(0, 10)}...{address?.slice(-6)}</span>
                            </div>
                        </div>

                        <SlideToConfirm
                            onConfirm={handleWithdraw}
                            isLoading={step === 'processing'}
                            disabled={step === 'processing'}
                            text="SLIDE TO WITHDRAW"
                            side="NO"
                        />

                        <button
                            onClick={() => setStep('input')}
                            className="w-full py-3 border border-white/20 text-white rounded-xl hover:bg-white/5 transition-all"
                        >
                            Cancel
                        </button>
                    </motion.div>
                )}

                {/* Processing Step */}
                {step === 'processing' && (
                    <div className="text-center py-8">
                        <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
                        <p className="text-white">Please sign in wallet...</p>
                        <p className="text-white/50 text-sm mt-2">Do not close this window</p>
                    </div>
                )}

                {/* Complete Step */}
                {step === 'complete' && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                        <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">Withdrawal Successful!</h3>
                        <p className="text-white/50 mb-4">${withdrawAmount} USDC has been sent to your wallet</p>
                        {txHash && (
                            <a
                                href={`https://testnet.bscscan.com/tx/${txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary text-sm hover:underline"
                            >
                                View on BscScan →
                            </a>
                        )}
                        <button
                            onClick={() => {
                                setStep('input');
                                setWithdrawAmount('');
                            }}
                            className="mt-6 px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all"
                        >
                            Done
                        </button>
                    </motion.div>
                )}

                {/* Error Step */}
                {step === 'error' && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                        <AlertCircle className="w-16 h-16 text-danger mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">Withdrawal Failed</h3>
                        <p className="text-white/50 mb-4 max-w-xs mx-auto text-sm">{errorMessage}</p>
                        <button
                            onClick={() => setStep('input')}
                            className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all"
                        >
                            Try Again
                        </button>
                    </motion.div>
                )}
            </div>

            {/* Info Box */}
            <div className="bg-white/5 border border-white/10 p-6 rounded-xl">
                <h3 className="text-white font-bold mb-3">💡 About Withdrawals</h3>
                <ul className="list-disc list-inside text-sm text-white/60 space-y-2">
                    <li>Withdrawals are processed directly by the smart contract</li>
                    <li>Funds arrive in your wallet immediately after confirmation</li>
                    <li>You must sign the transaction to authorize the withdrawal</li>
                </ul>
            </div>
        </div>
    );
}
