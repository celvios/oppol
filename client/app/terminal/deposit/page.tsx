"use client";

import { Copy, Wallet, ArrowRight, CheckCircle, ChevronDown, ArrowDown } from "lucide-react";
import { useState, useEffect } from "react";
import { QRCodeSVG } from 'qrcode.react';
import { useWallet } from "@/lib/use-wallet";
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { getContracts } from "@/lib/contracts";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";

// Get contract addresses
const contracts = getContracts() as any;
const USDC_ADDRESS = (contracts.mockUSDC || '0x0eAD2Cc3B5eC12B69140410A1F4Dc8611994E6Be') as `0x${string}`;
const ZAP_ADDRESS = (contracts.zap || '0xEF9C67639CE5fbCE07E0448bcc59587797742B0A68') as `0x${string}`;
const MARKET_CONTRACT = (contracts.predictionMarketLMSR || contracts.predictionMarket || '0x58c957342B8cABB9bE745BeBc09C267b70137959') as `0x${string}`;

// Mock Tokens
const TOKENS = [
    { symbol: 'USDC', name: 'USD Coin', icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=024', address: USDC_ADDRESS },
    { symbol: 'USDT', name: 'Tether', icon: 'https://cryptologos.cc/logos/tether-usdt-logo.png?v=024', address: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd' },
    { symbol: 'BNB', name: 'Binance Coin', icon: 'https://cryptologos.cc/logos/bnb-bnb-logo.png?v=024', address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' }, // WBNB
];

// ABI for Standard ERC20
const ERC20_ABI = [
    {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
        outputs: [{ name: '', type: 'bool' }],
    },
    {
        name: 'mint',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
        outputs: [],
    },
] as const;

// Market Contract ABI for deposit
const MARKET_ABI = [
    {
        name: 'deposit',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'amount', type: 'uint256' }],
        outputs: [],
    },
] as const;

// Zap ABI
const ZAP_ABI = [
    {
        name: 'zapInToken',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'tokenIn', type: 'address' },
            { name: 'amountIn', type: 'uint256' },
            { name: 'minUSDC', type: 'uint256' }
        ],
        outputs: [],
    },
] as const;

export default function DepositPage() {
    const { isConnected, address, usdcBalance, bnbBalance } = useWallet();
    const [copied, setCopied] = useState(false);
    const [custodialAddress, setCustodialAddress] = useState<string>('');

    // Optimistic: Default to false if we have a cache or if we are connected
    const [loading, setLoading] = useState(() => {
        if (typeof window !== 'undefined') {
            const hasCache = !!localStorage.getItem('cached_wallet_address');
            // If we have cache, we are not loading. If we are waiting for initial mount, we might be loading.
            return !hasCache;
        }
        return true;
    });

    // Deposit State
    const [depositAmount, setDepositAmount] = useState('');
    const [selectedToken, setSelectedToken] = useState(TOKENS[0]); // Default USDC
    const [showTokenList, setShowTokenList] = useState(false);
    const [step, setStep] = useState<'input' | 'approving' | 'swapping' | 'depositing' | 'complete'>('input');

    // Helper to get balance for selected token
    const getBalance = () => {
        if (selectedToken.symbol === 'USDC') return usdcBalance;
        if (selectedToken.symbol === 'BNB') return bnbBalance;
        return '0.00';
    };

    // Helper to set max balance
    const handleMax = () => {
        const balance = getBalance();
        if (balance && balance !== '0.00') {
            // Remove commas for input
            setDepositAmount(balance.replace(/,/g, ''));
        }
    };

    // Swap State (Mock)
    const [estimatedUSDC, setEstimatedUSDC] = useState('0.00');
    useEffect(() => {
        if (!depositAmount) {
            setEstimatedUSDC('0.00');
            return;
        }
        // Mock Rate Calculation
        const amount = parseFloat(depositAmount);
        let rate = 1;
        if (selectedToken.symbol === 'USDT') rate = 0.999;
        if (selectedToken.symbol === 'BNB') rate = 620.50;

        setEstimatedUSDC((amount * rate).toFixed(2));
    }, [depositAmount, selectedToken]);


    // Contract Write
    const { writeContract, data: hash, isPending, error } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    const [needsDeposit, setNeedsDeposit] = useState(false);

    // Watch for success
    useEffect(() => {
        if (isSuccess && hash) {
            if (step === 'approving') {
                setNeedsDeposit(true);
            } else if (step === 'depositing' || step === 'swapping') {
                setStep('complete');
            }
        }
    }, [isSuccess, hash, step]);

    useEffect(() => {
        if (needsDeposit && !isPending && !isConfirming) {
            setNeedsDeposit(false);
            setTimeout(() => handleDeposit(), 1000);
        }
    }, [needsDeposit, isPending, isConfirming]);

    // Fetch custodial wallet logic with caching
    useEffect(() => {
        let mounted = true;
        const controller = new AbortController();

        async function fetchWallet() {
            try {
                // 1. Check Cache First (Instant Render)
                const cachedWallet = localStorage.getItem('cached_wallet_address');
                if (cachedWallet && mounted) {
                    setCustodialAddress(cachedWallet);
                    setLoading(false);
                }

                const sessionToken = localStorage.getItem('session_token');
                if (!sessionToken) {
                    if (mounted) {
                        // Default fallback if no session and no cache
                        if (!cachedWallet) {
                            setCustodialAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
                        }
                        setLoading(false);
                    }
                    return;
                }

                const payload = JSON.parse(atob(sessionToken.split('.')[1]));
                // Cache key per user
                const cacheKey = `cached_wallet_${payload.userId}`;
                const userCachedWallet = localStorage.getItem(cacheKey);

                if (userCachedWallet && mounted) {
                    setCustodialAddress(userCachedWallet);
                    setLoading(false);
                }

                // 2. Network Fetch (Background Revalidation)
                const timeoutId = setTimeout(() => controller.abort(), 8000);

                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/wallet/${payload.userId}`, {
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) throw new Error('Network response was not ok');

                const data = await response.json();

                if (mounted) {
                    if (data.success && data.wallet) {
                        setCustodialAddress(data.wallet.public_address);
                        // Update Caches
                        localStorage.setItem('cached_wallet_address', data.wallet.public_address);
                        localStorage.setItem(cacheKey, data.wallet.public_address);
                    } else if (!userCachedWallet && !cachedWallet) {
                        setCustodialAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
                    }
                }
            } catch (e) {
                console.warn('Background wallet fetch failed/aborted:', e);
                // If we don't have a cached value and fetch failed, show default
                if (mounted && !custodialAddress) {
                    setCustodialAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
                }
            } finally {
                if (mounted) setLoading(false);
            }
        }

        fetchWallet();

        return () => {
            mounted = false;
            controller.abort();
        };
    }, []);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleApprove = async () => {
        if (!depositAmount || parseFloat(depositAmount) <= 0) return;
        setStep('approving');

        const isZap = selectedToken.symbol !== 'USDC';
        const spender = isZap ? ZAP_ADDRESS : MARKET_CONTRACT;
        const tokenAddress = (selectedToken as any).address || USDC_ADDRESS;

        try {
            writeContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [spender, parseUnits(depositAmount, 6)],
            });
        } catch (err) {
            console.error(err);
            setStep('input');
        }
    };

    const handleDeposit = async () => {
        const isZap = selectedToken.symbol !== 'USDC';
        setStep(isZap ? 'swapping' : 'depositing');

        try {
            if (isZap) {
                const minUSDC = parseUnits((parseFloat(estimatedUSDC) * 0.98).toString(), 6);
                const tokenAddress = (selectedToken as any).address || USDC_ADDRESS;

                writeContract({
                    address: ZAP_ADDRESS,
                    abi: ZAP_ABI,
                    functionName: 'zapInToken',
                    args: [tokenAddress, parseUnits(depositAmount, 6), minUSDC],
                });
            } else {
                writeContract({
                    address: MARKET_CONTRACT,
                    abi: MARKET_ABI,
                    functionName: 'deposit',
                    args: [parseUnits(depositAmount, 6)],
                });
            }
        } catch (err) {
            console.error(err);
            setStep('input');
        }
    };

    // If we are NOT loading, OR if we are Connected, show the UI.
    // This allows connected users to skip the loader entirely.
    if (loading && !isConnected) return <SkeletonLoader />;

    return (
        <div className="max-w-2xl mx-auto space-y-8 pt-8">
            <div className="text-center">
                <h1 className="text-3xl font-mono font-bold text-white mb-2">DEPOSIT FUNDS</h1>
                <p className="text-white/50">Add funds to start trading. Auto-converted to USDC.</p>
            </div>

            {/* WalletConnect User */}
            {isConnected ? (
                <div className="bg-surface/50 backdrop-blur-md border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Direct Deposit</h2>
                            <p className="text-sm text-white/50">{address?.slice(0, 8)}...{address?.slice(-6)}</p>
                        </div>
                    </div>

                    {step === 'input' ? (
                        <div className="space-y-4">
                            {/* Token Select & Input */}
                            <div className="bg-black/40 border border-white/10 rounded-xl p-4">
                                <div className="flex justify-between mb-2">
                                    <label className="text-sm font-medium text-white/60">You pay</label>
                                    <button
                                        onClick={handleMax}
                                        className="text-xs text-secondary hover:text-white cursor-pointer transition-colors"
                                    >
                                        Balance: {getBalance()}
                                    </button>
                                </div>

                                <div className="flex gap-4">
                                    <input
                                        type="number"
                                        value={depositAmount}
                                        onChange={(e) => setDepositAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-transparent text-2xl font-mono text-white placeholder:text-white/20 focus:outline-none"
                                    />

                                    <div className="relative">
                                        <button
                                            onClick={() => setShowTokenList(!showTokenList)}
                                            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition-colors min-w-[120px]"
                                        >
                                            <img src={selectedToken.icon} alt={selectedToken.symbol} className="w-6 h-6" />
                                            <span className="font-bold text-white">{selectedToken.symbol}</span>
                                            <ChevronDown size={16} className="text-white/50 ml-auto" />
                                        </button>

                                        {showTokenList && (
                                            <div className="absolute right-0 top-full mt-2 w-full bg-[#1A1A1C] border border-white/10 rounded-xl overflow-hidden shadow-xl z-20">
                                                {TOKENS.map(token => (
                                                    <button
                                                        key={token.symbol}
                                                        onClick={() => { setSelectedToken(token); setShowTokenList(false); }}
                                                        className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors text-left"
                                                    >
                                                        <img src={token.icon} alt={token.symbol} className="w-6 h-6" />
                                                        <span className="text-white font-medium">{token.symbol}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-center -my-2 relative z-10">
                                <div className="bg-surface p-2 rounded-full border border-white/10">
                                    <ArrowDown size={16} className="text-white/50" />
                                </div>
                            </div>

                            <div className="bg-black/40 border border-white/10 rounded-xl p-4">
                                <div className="flex justify-between mb-2">
                                    <label className="text-sm font-medium text-white/60">You receive (Estimated)</label>
                                </div>
                                <div className="flex gap-4 items-center">
                                    <div className="w-full bg-transparent text-2xl font-mono text-white/90">
                                        {estimatedUSDC}
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-2">
                                        <img src="https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=024" alt="USDC" className="w-6 h-6" />
                                        <span className="font-bold text-white">USDC</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleApprove}
                                disabled={!depositAmount || parseFloat(depositAmount) <= 0}
                                className="w-full py-4 bg-green-500 hover:bg-green-400 disabled:bg-white/5 disabled:text-white/20 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                {selectedToken.symbol === 'USDC' ? 'Approve & Deposit' : `Swap & Deposit`}
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            {isPending || step === 'swapping' ? (
                                <div className="w-16 h-16 relative mx-auto mb-6">
                                    <div className="w-16 h-16 border-4 border-white/10 rounded-full" />
                                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin absolute top-0 left-0" />
                                </div>
                            ) : null}

                            <h3 className="text-xl font-bold text-white mb-2">
                                {step === 'approving' && 'Step 1: Approving Token...'}
                                {step === 'swapping' && 'Step 2: Swapping to USDC...'}
                                {step === 'depositing' && 'Step 3: Depositing Funds...'}
                                {step === 'complete' && 'Deposit Successful!'}
                            </h3>

                            <p className="text-white/50 mb-6">
                                {step === 'complete'
                                    ? `$${estimatedUSDC} USDC has been added to your balance.`
                                    : 'Please confirm transaction in your wallet'}
                            </p>

                            {step === 'complete' && (
                                <button
                                    onClick={() => { setStep('input'); setDepositAmount(''); }}
                                    className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
                                >
                                    Make Another Deposit
                                </button>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                /* Custodial View */
                <div className="bg-surface/50 backdrop-blur-md border border-white/10 rounded-2xl p-6 text-center">
                    <h2 className="text-lg font-bold text-white mb-4">Scan to Deposit</h2>
                    <div className="bg-white p-6 rounded-xl inline-block mb-6">
                        <QRCodeSVG value={custodialAddress} size={180} />
                    </div>
                    <div className="bg-black/40 border border-white/10 p-4 rounded-xl flex items-center justify-between mb-6 max-w-sm mx-auto">
                        <code className="text-primary font-mono text-sm break-all">{custodialAddress}</code>
                        <button onClick={() => copyToClipboard(custodialAddress)}>
                            {copied ? <CheckCircle size={18} className="text-success" /> : <Copy size={18} className="text-white/60" />}
                        </button>
                    </div>
                    <p className="text-white/40 text-sm">
                        Send any base token (BNB, USDT, USDC) on <strong className="text-white">BNB Chain</strong>.
                        <br />It will be automatically converted to USDC.
                    </p>
                </div>
            )}
        </div>
    );
}
