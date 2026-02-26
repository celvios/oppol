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
import { clientToSigner } from "@/lib/viem-ethers-adapters";
import { web3MultiService } from "@/lib/web3-multi";
import { useUIStore } from "@/lib/store";
import { useWallets } from "@privy-io/react-auth";

const MARKET_ABI = [
    { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
];

const ERC20_ABI = [
    { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
    { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }
];

export default function WithdrawPage() {
    const { isConnected, address, connect, isConnecting, loginMethod } = useWallet();
    const { user, custodialAddress } = useUIStore();
    const { connector } = useAccount();
    const { data: connectorClient } = useConnectorClient();
    const { wallets } = useWallets();

    // Fix for Google Users seeing standard wallet UI
    // If loginMethod is social, we treat it as embedded/custodial
    const isSocialLogin = loginMethod === 'google' || loginMethod === 'email' || loginMethod === 'twitter' || loginMethod === 'discord';
    const isEmbeddedWallet = connector?.id === 'privy' || isSocialLogin || connector?.id === 'w3m-email' || connector?.id === 'auth';

    console.log('[WithdrawPage] DEBUG STATE:', {
        loginMethod,
        isEmbeddedWallet,
        connectorId: connector?.id,
        address, // This IS the effective address (Custodial if set)
        custodialAddress,
        storeUser: user
    });

    // Effective connection state
    const isEffectivelyConnected = isConnected;

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
    const [contractBalance, setContractBalance] = useState<string | null>(null); // Deposited in Game
    const [walletBalance, setWalletBalance] = useState<string | null>(null);   // In Wallet
    const [isLoading, setIsLoading] = useState(true);
    const [showConnectModal, setShowConnectModal] = useState(false);



    const contracts = getContracts() as any;
    const USDC_ADDRESS = contracts.usdc;
    const MARKET_CONTRACT = (contracts.predictionMarket || contracts.predictionMarketMulti || process.env.NEXT_PUBLIC_MARKET_ADDRESS) as `0x${string}`;

    const effectiveAddress = address;

    useEffect(() => {
        if (!isEffectivelyConnected) {
            setIsLoading(false);
            return;
        }

        if (effectiveAddress) {
            fetchAllBalances();
        } else {
            // Connected but no address yet (syncing?)
            // Timeout to stop loading if it takes too long
            const timer = setTimeout(() => {
                console.warn('[WithdrawPage] Timeout waiting for address');
                setContractBalance('0.00');
                setWalletBalance('0.00');
                setIsLoading(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [effectiveAddress, isEffectivelyConnected]);

    async function fetchAllBalances() {
        if (!effectiveAddress) {
            console.warn('[WithdrawPage] No effective address, cancelling fetch');
            setIsLoading(false);
            return;
        }
        console.log('[WithdrawPage] Fetching balances for:', effectiveAddress);
        setIsLoading(true);
        try {
            // 1. Get Game Balance (USDC already deposited into contract)
            const deposited = await web3MultiService.getDepositedBalance(effectiveAddress);
            setContractBalance(deposited);

            // 2. Get Wallet Balance — check both USDC AND USDT, show combined total
            const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed.binance.org/';
            const { ethers: eth } = await import('ethers');
            const provider = new eth.JsonRpcProvider(rpcUrl);

            const tokenAbi = [
                'function balanceOf(address) view returns (uint256)',
                'function decimals() view returns (uint8)',
            ];

            const USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_CONTRACT || '0x55d398326f99059fF775485246999027B3197955';

            const privyWallet = wallets?.find((w: any) => w.walletClientType === 'privy');
            const privyAddress = privyWallet?.address;

            const queries = [
                new eth.Contract(USDC_ADDRESS, tokenAbi, provider).balanceOf(effectiveAddress).catch(() => 0n),
                new eth.Contract(USDC_ADDRESS, tokenAbi, provider).decimals().catch(() => 18),
                new eth.Contract(USDT_ADDRESS, tokenAbi, provider).balanceOf(effectiveAddress).catch(() => 0n),
                new eth.Contract(USDT_ADDRESS, tokenAbi, provider).decimals().catch(() => 18),
            ];
            if (privyAddress) {
                queries.push(new eth.Contract(USDT_ADDRESS, tokenAbi, provider).balanceOf(privyAddress).catch(() => 0n));
            }

            const results = await Promise.all(queries);
            const usdcBal = results[0];
            const usdcDec = results[1];
            const usdtBal = results[2];
            const usdtDec = results[3];
            const privyUsdtBal = privyAddress ? results[4] : 0n;

            const usdcNum = parseFloat(eth.formatUnits(usdcBal, usdcDec));
            const usdtNum = parseFloat(eth.formatUnits(usdtBal, usdtDec));
            const privyUsdtNum = parseFloat(eth.formatUnits(privyUsdtBal, usdtDec));

            const totalWallet = usdcNum + usdtNum;

            console.log(`[WithdrawPage] USDC: ${usdcNum}, USDT: ${usdtNum}, Privy USDT: ${privyUsdtNum}`);
            setWalletBalance(totalWallet.toFixed(6));



        } catch (error: any) {
            console.error('Failed to fetch balances:', error);
            if (contractBalance === null) setContractBalance('0.00');
            if (walletBalance === null) setWalletBalance('0.00');
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
            // Check for Custodial User (Google/Email)
            const isCustodialUser = loginMethod === 'google' || loginMethod === 'email' || loginMethod === 'twitter' || loginMethod === 'discord';

            if (isCustodialUser) {
                setProcessingStep('Processing secure withdrawal...');
                console.log("Custodial Withdrawal initiated for:", user?.privy_user_id);

                if (!user?.privy_user_id) {
                    throw new Error("User session not fully synced. Please wait or refresh.");
                }

                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/wallet/custodial-withdraw`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_SECRET || ''
                    },
                    body: JSON.stringify({
                        privyUserId: user.privy_user_id,
                        amount: amount,
                        destinationAddress: isEmbeddedWallet ? destinationAddress : undefined
                    })
                });

                const data = await response.json();
                if (!data.success) throw new Error(data.error || 'Withdrawal failed');

                setTxHash(data.txHash);
                setStep('complete');
                setTimeout(fetchAllBalances, 2000);
                return;
            }

            if (!connectorClient) throw new Error('Wallet not ready');
            const signer = clientToSigner(connectorClient);
            const amountInUSDC = ethers.parseUnits(amount, 6);     // 6 decimals for USDC transfer
            const amountInShares = ethers.parseUnits(amount, 18);  // 18 decimals for Market withdraw

            // --- SMART CASH OUT (Embedded Wallet) ---
            if (isEmbeddedWallet) {
                if (!isAddress(destinationAddress)) throw new Error("Invalid destination address");

                // Logic: 
                // 1. Check if we need to withdraw from game first
                // contractBalance and walletBalance strings represent value (e.g. "1.0")
                const contractBalanceValue = contractBalance ? parseFloat(contractBalance) : 0;
                const walletBalanceValue = walletBalance ? parseFloat(walletBalance) : 0;
                const totalAvailable = contractBalanceValue + walletBalanceValue;

                const requestedAmount = parseFloat(amount);

                // If asking for more than total available
                if (requestedAmount > totalAvailable) {
                    // small epsilon check?
                    if (requestedAmount > totalAvailable + 0.000001) {
                        throw new Error("Insufficient total funds.");
                    }
                }

                const walletBalanceUSDC = walletBalance ? ethers.parseUnits(walletBalance, 6) : BigInt(0);

                // Step 1: Withdraw from Game if needed
                // If wallet balance is NOT enough to cover the transfer, we must withdraw from game
                if (walletBalanceUSDC < amountInUSDC) {
                    const neededFromGameUSDC = amountInUSDC - walletBalanceUSDC;
                    // Convert needed USDC amount to Shares (6 -> 18 decimals)
                    // We can parse the string representation of the needed amount
                    const neededValueStr = ethers.formatUnits(neededFromGameUSDC, 6);
                    const neededFromGameShares = ethers.parseUnits(neededValueStr, 18);

                    if (neededFromGameShares > BigInt(0)) {
                        setProcessingStep('Withdrawing funds from Game...');
                        console.log(`Smart Withdraw: Need ${neededValueStr} from game.`);

                        const marketContract = new Contract(MARKET_CONTRACT, MARKET_ABI, signer);
                        const withdrawTx = await marketContract.withdraw(neededFromGameShares);
                        await withdrawTx.wait();

                        // Refresh balance locally or wait?
                    }
                }

                // Step 2: Transfer to External
                setProcessingStep('Sending funds to external wallet...');
                const usdcContract = new Contract(USDC_ADDRESS, ERC20_ABI, signer);
                const tx = await usdcContract.transfer(destinationAddress, amountInUSDC);

                console.log('Transfer sent:', tx.hash);
                const receipt = await tx.wait();
                setTxHash(receipt.hash);

            } else {
                // --- STANDARD FLOW (External Wallet) ---
                if (activeTab === 'withdraw') {
                    setProcessingStep('Withdrawing to wallet...');
                    const marketContract = new Contract(MARKET_CONTRACT, MARKET_ABI, signer);
                    // Standard withdraw uses Shares (18 decimals)
                    const tx = await marketContract.withdraw(amountInShares);
                    await tx.wait();
                    setTxHash(tx.hash);
                } else {
                    // Transfer (Hidden for normal users usually, but logic remains)
                    setProcessingStep('Transferring...');
                    const usdcContract = new Contract(USDC_ADDRESS, ERC20_ABI, signer);
                    const tx = await usdcContract.transfer(destinationAddress, amountInUSDC);
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

    // Use BigInt for precise math
    // Fix: Contract balance is 18 decimals (Shares), but we need to combine with Wallet (6 decimals USDC)
    // We cannot parse an 18-decimal string with parseUnits(..., 6) as it throws "underflow" if decimals > 6
    const contractBalanceWei18 = contractBalance ? ethers.parseUnits(contractBalance, 18) : BigInt(0);
    const contractBalanceWei = contractBalanceWei18 / BigInt(10 ** 12); // Convert 18 -> 6 decimals (truncate)

    const walletBalanceWei = walletBalance ? ethers.parseUnits(walletBalance, 6) : BigInt(0);

    const availableBalanceWei = isEmbeddedWallet
        ? contractBalanceWei + walletBalanceWei
        : (activeTab === 'withdraw' ? contractBalanceWei : walletBalanceWei);

    const availableBalance = ethers.formatUnits(availableBalanceWei, 6);

    const canProceed = availableBalanceWei > BigInt(0);

    // Show skeleton if loading OR if we are connected but balances are still null (initial fetch pending)
    if (isConnecting || isLoading || (isEffectivelyConnected && (contractBalance === null || walletBalance === null))) {
        return <SkeletonLoader />;
    }

    if (!isEffectivelyConnected) {
        return (
            <div className="max-w-2xl mx-auto pt-12 pb-24 text-center">
                <div className="bg-surface/50 backdrop-blur-md border border-white/10 rounded-2xl p-8 max-w-md mx-auto">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/20 flex items-center justify-center">
                        <Wallet className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-3">Login Required</h2>
                    <p className="text-white/50 mb-6">Connect to manage your funds.</p>
                    <button onClick={connect} className="px-8 py-3 bg-primary text-black font-bold rounded-xl hover:bg-primary/90">
                        Log In
                    </button>
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
                            {isEmbeddedWallet ? 'Total Available Balance' : (activeTab === 'withdraw' ? 'Balance' : 'Wallet Balance')}
                        </p>
                        <p className="text-2xl font-mono font-bold text-white">
                            ${parseFloat(availableBalance.toString()).toFixed(2)}
                            <span className="text-sm text-white/30 ml-2">USDC</span>
                        </p>
                        <p className="text-xs text-white/30 mt-1 font-mono">
                            {availableBalance.toString()}
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
                            isLoading={false}
                            disabled={false}
                            side="YES"
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
                            className="w-full py-4 bg-primary disabled:bg-white/10 text-black disabled:text-white/40 font-bold rounded-xl disabled:cursor-not-allowed hover:bg-primary/90 transition-all shadow-lg"
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
