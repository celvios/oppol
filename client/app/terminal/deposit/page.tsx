"use client";

import { Copy, Wallet, ArrowRight, CheckCircle, AlertCircle, ChevronDown, RefreshCcw, ArrowDown } from "lucide-react";
import { useState, useEffect } from "react";
import { QRCodeSVG } from 'qrcode.react';
import { useWallet } from "@/lib/use-wallet";
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { getContracts } from "@/lib/contracts";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { motion, AnimatePresence } from "framer-motion";

// Get contract addresses
const contracts = getContracts() as any;
const USDC_ADDRESS = (contracts.mockUSDC || '0x0eAD2Cc3B5eC12B69140410A1F4Dc8611994E6Be') as `0x${string}`;
const ZAP_ADDRESS = (contracts.zap || '0xEF9C67639CE5fbCE07E0448bcc59587797742B0A68') as `0x${string}`;
const MARKET_CONTRACT = (contracts.predictionMarket || '0xEcB7195979Cb5781C2D6b4e97cD00b159922A6B3') as `0x${string}`;

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

// Zap Contract Address (Replace with actual deployment)
// Zap Contract Address (Use constant from above)
// const ZAP_ADDRESS removed


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
    const { isConnected, address } = useWallet();
    const [copied, setCopied] = useState(false);
    const [custodialAddress, setCustodialAddress] = useState<string>('');
    const [loading, setLoading] = useState(true);

    // Deposit State
    const [depositAmount, setDepositAmount] = useState('');
    const [selectedToken, setSelectedToken] = useState(TOKENS[0]); // Default USDC
    const [showTokenList, setShowTokenList] = useState(false);
    const [step, setStep] = useState<'input' | 'approving' | 'swapping' | 'depositing' | 'complete'>('input');

    // Faucet State
    const [isMinting, setIsMinting] = useState(false);
    const [mintSuccess, setMintSuccess] = useState(false);
    const [showMintModal, setShowMintModal] = useState(false);
    const [targetMintAddress, setTargetMintAddress] = useState('');

    // Pre-fill target address when wallet connects
    useEffect(() => {
        if (address) setTargetMintAddress(address);
    }, [address]);

    // ... (keep existing useEffects)

    const handleMintUSDC = async (target?: string) => {
        const recipient = target || address;
        if (!recipient) return;

        setIsMinting(true);
        setMintSuccess(false);
        try {
            writeContract({
                address: USDC_ADDRESS,
                abi: ERC20_ABI,
                functionName: 'mint',
                args: [recipient, parseUnits('10000', 6)],
            });
            setShowMintModal(false);
        } catch (err) {
            console.error(err);
        } finally {
            setIsMinting(false);
        }
    };

    if (loading) return <SkeletonLoader />;

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

                    {/* Faucet */}
                    <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between">
                        <div>
                            <h3 className="text-amber-400 font-bold text-sm">🚰 Testnet Faucet</h3>
                            <p className="text-white/50 text-xs">Mint 10,000 test USDC</p>
                        </div>
                        <button
                            onClick={() => setShowMintModal(true)}
                            className="px-4 py-2 bg-amber-500 text-black font-bold rounded-lg text-sm hover:bg-amber-600 transition-colors"
                        >
                            Open Faucet
                        </button>
                    </div>

                    {step === 'input' ? (
                        <div className="space-y-4">
                            {/* Token Select & Input */}
                            <div className="bg-black/40 border border-white/10 rounded-xl p-4">
                                <div className="flex justify-between mb-2">
                                    <label className="text-sm font-medium text-white/60">You pay</label>
                                    <span className="text-xs text-secondary hover:text-white cursor-pointer">Balance: --</span>
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
                                        <span className="text-lg">💰</span>
                                        <span className="font-bold text-white">USDC</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleApprove}
                                disabled={!depositAmount || parseFloat(depositAmount) <= 0}
                                className="w-full py-4 bg-primary hover:bg-primary/80 disabled:bg-white/10 disabled:text-white/30 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2"
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
            {/* Mint Modal */}
            <AnimatePresence>
                {showMintModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-surface border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
                        >
                            <div className="p-6 relative">
                                <button
                                    onClick={() => setShowMintModal(false)}
                                    className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
                                >
                                    <div className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10">
                                        <Copy size={16} className="rotate-45" /> {/* Using Copy as X placeholder or import X */}
                                    </div>
                                </button>

                                <h2 className="text-xl font-bold text-white mb-6">Mint Testnet USDC</h2>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-white/40 uppercase tracking-wider block mb-2">Target Wallet Address</label>
                                        <input
                                            type="text"
                                            value={targetMintAddress}
                                            onChange={(e) => setTargetMintAddress(e.target.value)}
                                            placeholder="0x..."
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-primary/50 transition-colors"
                                        />
                                    </div>

                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
                                        <div className="mt-1">
                                            <AlertCircle size={16} className="text-amber-500" />
                                        </div>
                                        <p className="text-sm text-amber-200/80">
                                            You are about to mint <strong className="text-white">10,000 USDC</strong> to this address on BSC Testnet.
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => handleMintUSDC(targetMintAddress)}
                                        disabled={isMinting || !targetMintAddress || !targetMintAddress.startsWith('0x')}
                                        className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:hover:bg-amber-500 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2 mt-2"
                                    >
                                        {isMinting ? (
                                            <>
                                                <RefreshCcw className="w-4 h-4 animate-spin" />
                                                Minting...
                                            </>
                                        ) : (
                                            <>
                                                Mint 10,000 USDC
                                                <ArrowRight className="w-4 h-4" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
