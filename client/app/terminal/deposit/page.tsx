"use client";

import { Copy, Wallet, ArrowRight, CheckCircle, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { QRCodeSVG } from 'qrcode.react';
import { useWallet } from "@/lib/use-wallet";
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { getContracts } from "@/lib/contracts";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";

// Get contract addresses from config
const contracts = getContracts() as any;
const USDC_ADDRESS = (contracts.mockUSDC || '0x0eAD2Cc3B5eC12B69140410A1F4Dc8611994E6Be') as `0x${string}`;
const MARKET_CONTRACT = (contracts.predictionMarket || '0xEcB7195979Cb5781C2D6b4e97cD00b159922A6B3') as `0x${string}`;

// ERC20 ABI for approve and mint (MockUSDC has public mint)
const ERC20_ABI = [
    {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
    {
        name: 'allowance',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' }
        ],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'mint',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        outputs: [],
    },
] as const;

// Market Contract ABI for deposit
const MARKET_ABI = [
    {
        name: 'deposit',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'amount', type: 'uint256' }
        ],
        outputs: [],
    },
] as const;

export default function DepositPage() {
    const { isConnected, address } = useWallet();
    const [copied, setCopied] = useState(false);
    const [custodialAddress, setCustodialAddress] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [depositAmount, setDepositAmount] = useState('');
    const [step, setStep] = useState<'input' | 'approving' | 'depositing' | 'complete'>('input');
    const [isMinting, setIsMinting] = useState(false);
    const [mintSuccess, setMintSuccess] = useState(false);

    // Contract write for approval
    const { writeContract, data: hash, isPending, error } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    // Watch for successful transaction (approval or deposit)
    useEffect(() => {
        if (isSuccess && step === 'approving') {
            // Approval done, now do the actual deposit
            handleDeposit();
        } else if (isSuccess && step === 'depositing') {
            // Deposit complete!
            setStep('complete');
        }
    }, [isSuccess]);

    // Fetch custodial wallet for non-connected users
    useEffect(() => {
        async function fetchWallet() {
            try {
                const sessionToken = localStorage.getItem('session_token');
                if (!sessionToken) {
                    setCustodialAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
                    setLoading(false);
                    return;
                }

                const payload = JSON.parse(atob(sessionToken.split('.')[1]));
                const userId = payload.userId;

                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/wallet/${userId}`);
                const data = await response.json();

                if (data.success && data.wallet) {
                    setCustodialAddress(data.wallet.public_address);
                } else {
                    setCustodialAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
                }
            } catch (error) {
                console.error('Error fetching wallet:', error);
                setCustodialAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
            } finally {
                setLoading(false);
            }
        }
        fetchWallet();
    }, []);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleApprove = async () => {
        if (!depositAmount || parseFloat(depositAmount) <= 0) return;

        setStep('approving');

        try {
            writeContract({
                address: USDC_ADDRESS,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [MARKET_CONTRACT, parseUnits(depositAmount, 6)],
            });
        } catch (err) {
            console.error('Approval error:', err);
            setStep('input');
        }
    };

    // Step 2: Deposit into market contract
    const handleDeposit = async () => {
        if (!depositAmount || parseFloat(depositAmount) <= 0) return;

        setStep('depositing');

        try {
            writeContract({
                address: MARKET_CONTRACT,
                abi: MARKET_ABI,
                functionName: 'deposit',
                args: [parseUnits(depositAmount, 6)],
            });
        } catch (err) {
            console.error('Deposit error:', err);
            setStep('input');
        }
    };

    // Mint test USDC (Faucet)
    const handleMintUSDC = async () => {
        if (!address) return;
        setIsMinting(true);
        setMintSuccess(false);
        try {
            writeContract({
                address: USDC_ADDRESS,
                abi: ERC20_ABI,
                functionName: 'mint',
                args: [address, parseUnits('10000', 6)], // Mint 10,000 USDC
            });
        } catch (err) {
            console.error('Mint error:', err);
        } finally {
            setIsMinting(false);
        }
    };

    if (loading) {
        return <SkeletonLoader />;
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8 pt-8">
            <div className="text-center">
                <h1 className="text-3xl font-mono font-bold text-white mb-2">DEPOSIT FUNDS</h1>
                <p className="text-white/50">Add USDC to start trading on prediction markets</p>
            </div>

            {/* WalletConnect User - Direct Deposit */}
            {isConnected ? (
                <div className="bg-surface/50 backdrop-blur-md border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Direct Deposit</h2>
                            <p className="text-sm text-white/50">Connected: {address?.slice(0, 8)}...{address?.slice(-6)}</p>
                        </div>
                    </div>

                    {/* Faucet Button - Mint Test USDC */}
                    <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-amber-400 font-bold text-sm">🚰 Test USDC Faucet</h3>
                                <p className="text-white/50 text-xs">Mint 10,000 test USDC to your wallet</p>
                            </div>
                            <button
                                onClick={handleMintUSDC}
                                disabled={isMinting || isPending}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg text-sm transition-all disabled:opacity-50"
                            >
                                {isMinting || isPending ? 'Minting...' : 'Mint USDC'}
                            </button>
                        </div>
                        {isSuccess && (
                            <p className="text-success text-xs mt-2">✅ 10,000 USDC minted successfully!</p>
                        )}
                    </div>

                    {step === 'input' && (
                        <>
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-white/60 mb-2">
                                    Amount (USDC)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={depositAmount}
                                        onChange={(e) => setDepositAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full px-4 py-4 bg-black/40 border border-white/10 rounded-xl text-white text-2xl font-mono placeholder:text-white/20 focus:outline-none focus:border-primary/50"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40">USDC</span>
                                </div>
                            </div>

                            <button
                                onClick={handleApprove}
                                disabled={!depositAmount || parseFloat(depositAmount) <= 0}
                                className="w-full py-4 bg-primary hover:bg-primary/80 disabled:bg-white/10 disabled:text-white/30 text-black font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                            >
                                Approve & Deposit
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </>
                    )}

                    {(step === 'approving' || step === 'depositing') && (
                        <div className="text-center py-8">
                            {isPending && (
                                <>
                                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                    <p className="text-white">
                                        {step === 'approving' ? 'Approve in your wallet...' : 'Confirm deposit in wallet...'}
                                    </p>
                                </>
                            )}
                            {isConfirming && (
                                <>
                                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                    <p className="text-white">
                                        {step === 'approving' ? 'Step 1/2: Approving USDC...' : 'Step 2/2: Depositing funds...'}
                                    </p>
                                    <p className="text-white/50 text-sm mt-2">TX: {hash?.slice(0, 16)}...</p>
                                </>
                            )}
                            {error && (
                                <>
                                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                                    <p className="text-red-400">Transaction failed</p>
                                    <button
                                        onClick={() => setStep('input')}
                                        className="mt-4 text-primary hover:underline"
                                    >
                                        Try again
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {step === 'complete' && (
                        <div className="text-center py-8">
                            <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">Deposit Successful!</h3>
                            <p className="text-white/50 mb-4">
                                ${depositAmount} USDC has been deposited
                            </p>
                            <button
                                onClick={() => { setStep('input'); setDepositAmount(''); }}
                                className="text-primary hover:underline"
                            >
                                Make another deposit
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                /* Custodial User - QR Code Deposit */
                <div className="bg-surface/50 backdrop-blur-md border border-white/10 rounded-2xl p-6 text-center">
                    <h2 className="text-lg font-bold text-white mb-4">Scan to Deposit</h2>

                    <div className="bg-white p-6 rounded-xl inline-block mb-6">
                        <QRCodeSVG
                            value={custodialAddress}
                            size={180}
                            level="H"
                            includeMargin={false}
                        />
                    </div>

                    <div className="bg-black/40 border border-white/10 p-4 rounded-xl flex items-center justify-between mb-6">
                        <code className="text-primary font-mono text-sm break-all">{custodialAddress}</code>
                        <button
                            onClick={() => copyToClipboard(custodialAddress)}
                            className="ml-4 p-2 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
                        >
                            {copied ? <span className="text-success text-xs font-bold">COPIED</span> : <Copy size={18} />}
                        </button>
                    </div>

                    <p className="text-white/40 text-sm">
                        Send USDC on <strong className="text-white/60">BNB Chain</strong> to this address
                    </p>
                </div>
            )}

            {/* Important Notes */}
            <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-xl">
                <h3 className="text-amber-400 font-bold mb-3">⚠️ Important</h3>
                <ul className="list-disc list-inside text-sm text-white/70 space-y-2">
                    <li>Only send <strong>USDC</strong> on <strong>BNB Chain (BSC)</strong></li>
                    <li>Minimum deposit: $10</li>
                    <li>Assets sent to wrong network may be lost</li>
                    <li>Deposits are credited after 12 confirmations (~1 min)</li>
                </ul>
            </div>
        </div>
    );
}
