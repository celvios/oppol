"use client";

import { ArrowDownRight, Wallet, CheckCircle, AlertCircle, Loader2, Send, ArrowRightLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { useWallet } from "@/lib/use-wallet";
import { motion } from 'framer-motion';
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { SlideToConfirm } from "@/components/ui/SlideToConfirm";
import { getContracts, NETWORK } from '@/lib/contracts';
import { Contract, ethers, isAddress } from 'ethers';
import { useConnectorClient, useAccount } from 'wagmi';
import ConnectWalletModal from "@/components/wallet/ConnectWalletModal";
import { clientToSigner } from "@/lib/viem-ethers-adapters";
import { web3MultiService } from "@/lib/web3-multi";

const MARKET_ABI = [
    { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
];

const ERC20_ABI = [
    { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
    { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }
];

import { usePrivy } from "@privy-io/react-auth";

export default function WithdrawPage() {
    const { isConnected, address, connect } = useWallet();
    const { message: connectorMessage, connector } = useAccount();
    const { data: connectorClient } = useConnectorClient();
    const { user, authenticated } = usePrivy();

    // Effective connection state
    const isEffectivelyConnected = isConnected || authenticated;

    // Detect Embedded Wallet (Privy) - Robust Check
    const isEmbeddedWallet =
        user?.wallet?.walletClientType === 'privy' ||
        connector?.id === 'privy' ||
        connector?.name?.toLowerCase().includes('privy') ||
        connector?.name?.toLowerCase().includes('embedded');

    // Tab State (Only for Standard Wallets)
    const [activeTab, setActiveTab] = useState<'withdraw' | 'transfer'>('withdraw');

    // Form States
    const [amount, setAmount] = useState('');
    const [destinationAddress, setDestinationAddress] = useState('');

    // Flow State
    const [step, setStep] = useState<'input' | 'confirm' | 'processing' | 'complete' | 'error'>('input');
    const [txHash, setTxHash] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [processingStep, setProcessingStep] = useState(''); // e.g., "Withdrawing from game...", "Sending to wallet..."

    // Data State
    const [contractBalance, setContractBalance] = useState('0.00'); // Deposited in Game
    const [walletBalance, setWalletBalance] = useState('0.00');   // In Wallet
    const [isLoading, setIsLoading] = useState(false);
    const [showConnectModal, setShowConnectModal] = useState(false);

    const contracts = getContracts() as any;
    const USDC_ADDRESS = contracts.usdc;
    const MARKET_CONTRACT = (contracts.predictionMarket || contracts.predictionMarketMulti || process.env.NEXT_PUBLIC_MARKET_ADDRESS) as `0x${string}`;

    const effectiveAddress = address || user?.wallet?.address;

    useEffect(() => {
        if (effectiveAddress) {
            fetchAllBalances();
        }
    }, [effectiveAddress]);

    async function fetchAllBalances() {
        if (!effectiveAddress) return;
        setIsLoading(true);
        try {
            // 1. Get Game Balance
            const deposited = await web3MultiService.getDepositedBalance(effectiveAddress);
            setContractBalance(deposited);

            // 2. Get Wallet Balance
            if (connectorClient) {
                const signer = clientToSigner(connectorClient);
                const usdcContract = new Contract(USDC_ADDRESS, ERC20_ABI, signer);
                const balWei = await usdcContract.balanceOf(effectiveAddress);
                setWalletBalance(ethers.formatUnits(balWei, 18));
            }
        } catch (error: any) {
            console.error('Failed to fetch balances:', error);
        } finally {
            setIsLoading(false);
        }
    }

    async function handleAction() {
        if (!effectiveAddress || !amount || parseFloat(amount) <= 0) return;

        setStep('processing');
        setErrorMessage('');
        setTxHash('');

        try {
            if (!connectorClient) throw new Error('Wallet not ready');
            const signer = clientToSigner(connectorClient);
            const amountInWei = ethers.parseUnits(amount, 18);

            // --- SMART CASH OUT (Embedded Wallet) ---
            if (isEmbeddedWallet) {
                if (!isAddress(destinationAddress)) throw new Error("Invalid destination address");

                // Logic: 
                // 1. Check if we need to withdraw from game first
                const gameBal = parseFloat(contractBalance);
                const walletBal = parseFloat(walletBalance);
                const reqAmount = parseFloat(amount);

                // If asking for more than total available
                if (reqAmount > (gameBal + walletBal)) {
                    throw new Error("Insufficient total funds.");
                }

                // Step 1: Withdraw from Game if needed
                // If wallet balance is NOT enough to cover the transfer, we must withdraw from game
                if (walletBal < reqAmount) {
                    const neededFromGame = reqAmount - walletBal;
                    // Add a small buffer/check to ensure we don't try to withdraw 0.0000001
                    if (neededFromGame > 0) {
                        setProcessingStep('Withdrawing funds from Game...');
                        console.log(`Smart Withdraw: Need ${neededFromGame} from game.`);

                        const marketContract = new Contract(MARKET_CONTRACT, MARKET_ABI, signer);
                        // We withdraw EXACTLY what is needed? Or just withdraw everything?
                        // Safer to withdraw what is needed + buffer? Or just withdraw the 'amount' requested if it's all in game?
                        // Simplest logic: If user wants to cash out X, and X is in game, withdraw X.
                        // But if user has 50 in wallet and 50 in game, and wants 100?
                        // Let's implement: Withdraw (Amount - WalletBalance).

                        const withdrawAmountWei = ethers.parseUnits(neededFromGame.toFixed(18), 18); // Use fixed to avoid float errors
                        const withdrawTx = await marketContract.withdraw(withdrawAmountWei);
                        await withdrawTx.wait();

                        // Refresh balance locally or wait?
                    }
                }

                // Step 2: Transfer to External
                setProcessingStep('Sending funds to external wallet...');
                const usdcContract = new Contract(USDC_ADDRESS, ERC20_ABI, signer);
                const tx = await usdcContract.transfer(destinationAddress, amountInWei);

                console.log('Transfer sent:', tx.hash);
                const receipt = await tx.wait();
                setTxHash(receipt.hash);

            } else {
                // --- STANDARD FLOW (External Wallet) ---
                if (activeTab === 'withdraw') {
                    setProcessingStep('Withdrawing to wallet...');
                    const marketContract = new Contract(MARKET_CONTRACT, MARKET_ABI, signer);
                    const tx = await marketContract.withdraw(amountInWei);
                    await tx.wait();
                    setTxHash(tx.hash);
                } else {
                    // Transfer (Hidden for normal users usually, but logic remains)
                    setProcessingStep('Transferring...');
                    const usdcContract = new Contract(USDC_ADDRESS, ERC20_ABI, signer);
                    const tx = await usdcContract.transfer(destinationAddress, amountInWei);
                    await tx.wait();
                    setTxHash(tx.hash);
                }
            }

            setStep('complete');
            setTimeout(fetchAllBalances, 2000);

        } catch (error: any) {
            console.error('Action failed:', error);
            let msg = error.message || 'Transaction failed';

            if (msg.includes('user rejected') || error.code === 'ACTION_REJECTED') {
                msg = 'Transaction rejected';
            } else if (msg.includes('insufficient funds')) {
                msg = 'Insufficient funds';
            }

            setErrorMessage(msg);
            setStep('error');
        }
    }

    const availableBalance = isEmbeddedWallet
        ? (parseFloat(contractBalance) + parseFloat(walletBalance)) // Total Liquid Assets
        : (activeTab === 'withdraw' ? parseFloat(contractBalance) : parseFloat(walletBalance));

    const canProceed = availableBalance > 0;

    if (isLoading && !contractBalance && !walletBalance) return <SkeletonLoader />;

    if (!isEffectivelyConnected) {
        return (
            <div className="max-w-2xl mx-auto pt-12 pb-24 text-center">
                <div className="bg-surface/50 backdrop-blur-md border border-white/10 rounded-2xl p-8 max-w-md mx-auto">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/20 flex items-center justify-center">
                        <Wallet className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-3">Login Required</h2>
                    <p className="text-white/50 mb-6">Connect to manage your funds.</p>
                    <button onClick={() => setShowConnectModal(true)} className="px-8 py-3 bg-primary text-black font-bold rounded-xl hover:bg-primary/90">
                        Log In
                    </button>
                    <ConnectWalletModal isOpen={showConnectModal} onClose={() => setShowConnectModal(false)} onConnect={connect} context="withdraw" />
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6 pt-8 pb-24 px-4 overflow-hidden">

            <div className="text-center">
                <h1 className="text-3xl font-mono font-bold text-white mb-2">{isEmbeddedWallet ? 'CASH OUT' : 'MANAGE FUNDS'}</h1>
                <p className="text-white/50">{isEmbeddedWallet ? 'Withdraw funds directly to your external wallet.' : 'Withdraw funds to your connected wallet.'}</p>
            </div>

            {/* TABS (Only for Standard Wallets) */}
            {!isEmbeddedWallet && (
                <div className="text-center bg-white/5 rounded-xl border border-white/10 p-3 mb-4">
                    <p className="text-sm text-white/70">Connected: <span className="text-primary">{connector?.name || 'External Wallet'}</span></p>
                    <p className="text-xs text-white/40 mt-1">Withdrawals go directly to this wallet.</p>
                </div>
            )}

            <div className="bg-surface/50 backdrop-blur-md border border-white/10 rounded-2xl p-6 min-h-[400px]">

                {/* Balance Display */}
                <div className="flex justify-between items-center mb-6 pb-6 border-b border-white/5">
                    <div>
                        <p className="text-xs text-white/40 uppercase tracking-wider mb-1">
                            {isEmbeddedWallet ? 'Total Available Balance' : (activeTab === 'withdraw' ? 'Game Balance' : 'Wallet Balance')}
                        </p>
                        <p className="text-2xl font-mono font-bold text-white">
                            ${parseFloat(availableBalance.toString()).toFixed(2)}
                            <span className="text-sm text-white/30 ml-2">USDC</span>
                        </p>
                    </div>
                </div>

                {/* --- ERROR STEP --- */}
                {step === 'error' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
                        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-white mb-2">Transaction Failed</h3>
                        <p className="text-white/50 mb-6 text-sm">{errorMessage}</p>
                        <button onClick={() => setStep('input')} className="px-6 py-2 bg-white/10 rounded-lg text-white hover:bg-white/20">
                            Try Again
                        </button>
                    </motion.div>
                )}

                {/* --- SUCCESS STEP --- */}
                {step === 'complete' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
                        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-white mb-2">Success!</h3>
                        <p className="text-white/50 mb-6 text-sm">
                            Transaction completed successfully.
                        </p>
                        <button onClick={() => { setStep('input'); setAmount(''); setDestinationAddress(''); }} className="px-6 py-2 bg-white/10 rounded-lg text-white hover:bg-white/20">
                            Done
                        </button>
                    </motion.div>
                )}

                {/* --- PROCESSING STEP --- */}
                {step === 'processing' && (
                    <div className="text-center py-12">
                        <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
                        <p className="text-white font-medium">{processingStep || 'Processing Transaction...'}</p>
                        <p className="text-white/40 text-sm mt-2">Please do not close this window</p>
                    </div>
                )}

                {/* --- CONFIRM STEP --- */}
                {step === 'confirm' && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                        <div className="bg-black/20 p-4 rounded-xl space-y-3">
                            <div className="flex justify-between">
                                <span className="text-white/60">Action</span>
                                <span className="text-white font-bold uppercase">{isEmbeddedWallet ? 'CASH OUT' : activeTab}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/60">Amount</span>
                                <span className="text-primary font-mono text-lg">${amount}</span>
                            </div>
                            {isEmbeddedWallet && (
                                <div className="pt-3 border-t border-white/10 flex flex-col gap-1">
                                    <span className="text-white/60 text-xs">Destination Address</span>
                                    <span className="text-white font-mono text-xs break-all">{destinationAddress}</span>
                                </div>
                            )}
                        </div>

                        <SlideToConfirm
                            onConfirm={handleAction}
                            text={isEmbeddedWallet ? "SLIDE TO CASH OUT" : "SLIDE TO WITHDRAW"}
                        />

                        <button onClick={() => setStep('input')} className="w-full text-center text-white/40 hover:text-white text-sm">
                            Cancel
                        </button>
                    </motion.div>
                )}

                {/* --- INPUT STEP --- */}
                {step === 'input' && (
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">

                        {/* Amount Input */}
                        <div>
                            <label className="block text-xs text-white/50 uppercase font-bold mb-2">Amount (USDC)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-white text-lg font-mono placeholder:text-white/20 focus:outline-none focus:border-primary/50"
                                />
                                <button
                                    onClick={() => setAmount(availableBalance.toString())}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-primary text-xs font-bold hover:text-white"
                                >
                                    MAX
                                </button>
                            </div>
                        </div>

                        {/* Destination Input (Embedded Only) */}
                        {isEmbeddedWallet && (
                            <div>
                                <label className="block text-xs text-white/50 uppercase font-bold mb-2">To External Address (BSC)</label>
                                <input
                                    type="text"
                                    value={destinationAddress}
                                    onChange={(e) => setDestinationAddress(e.target.value)}
                                    placeholder="Paste your Binance/Metamask address here..."
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-white font-mono text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/50"
                                />
                                <p className="text-xs text-white/30 mt-2">Ensure this address accepts USDC on BNB Chain (BEP20).</p>
                            </div>
                        )}

                        <button
                            onClick={() => setStep('confirm')}
                            disabled={!canProceed || !amount || parseFloat(amount) <= 0 || (isEmbeddedWallet && !isAddress(destinationAddress))}
                            className="w-full py-4 bg-primary text-black font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-all shadow-lg"
                        >
                            {isEmbeddedWallet ? 'Review Cash Out' : 'Review Withdrawal'}
                        </button>
                    </motion.div>
                )}

            </div>
            {/* Info Footer */}
            <div className="text-center text-xs text-white/30 max-w-sm mx-auto">
                <p>
                    {activeTab === 'withdraw'
                        ? "Funds will be moved from the Game Contract to your connected Wallet."
                        : "Funds will be sent from your connected Wallet to the external address provided."}
                </p>
                {activeTab === 'transfer' && (
                    <p className="mt-1 text-yellow-500/50">Double check the address. Transactions cannot be reversed.</p>
                )}
            </div>
        </div>
    );
}
