"use client";

import { Copy, Wallet, CheckCircle, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { QRCodeSVG } from 'qrcode.react';
import { useCustodialWallet } from "@/lib/use-custodial-wallet";
import { LoginModal } from "@/components/ui/LoginModal";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { WalletModal } from "@/components/ui/WalletModal";
import { useWalletContext } from "@/lib/wallet-provider";
import { getContracts } from "@/lib/contracts";
import { Contract } from 'ethers';

const ERC20_ABI = [
    { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
];

const MARKET_ABI = [
    { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
];

export default function DepositPage() {
    const { isLoading, address, isCustodial, isWalletConnected, login } = useCustodialWallet();
    const { disconnect, connect, signer } = useWalletContext();
    const [showWalletModal, setShowWalletModal] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [usdcBalance, setUsdcBalance] = useState('0.00');
    const [depositAmount, setDepositAmount] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const contracts = getContracts() as any;
    const USDC_ADDRESS = contracts.mockUSDC || '0x0eAD2Cc3B5eC12B69140410A1F4Dc8611994E6Be';
    const MARKET_CONTRACT = contracts.predictionMarketLMSR || contracts.predictionMarket || '0x58c957342B8cABB9bE745BeBc09C267b70137959';

    useEffect(() => {
        if (address && signer) {
            fetchBalance();
        }
    }, [address, signer]);

    async function fetchBalance() {
        if (!signer || !address) return;
        try {
            const usdcContract = new Contract(USDC_ADDRESS, ERC20_ABI, signer);
            const balance = await usdcContract.balanceOf(address);
            setUsdcBalance((Number(balance) / 1e6).toFixed(2));
        } catch (error) {
            console.error('Failed to fetch balance:', error);
        }
    }

    async function handleDeposit() {
        if (!signer || !depositAmount || parseFloat(depositAmount) <= 0) return;
        setIsProcessing(true);
        try {
            const amount = BigInt(Math.floor(parseFloat(depositAmount) * 1e6));
            const usdcContract = new Contract(USDC_ADDRESS, ERC20_ABI, signer);
            const marketContract = new Contract(MARKET_CONTRACT, MARKET_ABI, signer);

            const approveTx = await usdcContract.approve(MARKET_CONTRACT, amount);
            await approveTx.wait();

            const depositTx = await marketContract.deposit(amount);
            await depositTx.wait();

            await fetchBalance();
            setDepositAmount('');
            alert('Deposit successful!');
        } catch (error: any) {
            console.error('Deposit failed:', error);
            alert(error.message || 'Deposit failed');
        } finally {
            setIsProcessing(false);
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (isLoading) return <SkeletonLoader />;

    return (
        <div className="max-w-2xl mx-auto space-y-8 pt-8">
            <div className="text-center">
                <h1 className="text-3xl font-mono font-bold text-white mb-2">DEPOSIT FUNDS</h1>
                <p className="text-white/50">Add funds to start trading. Auto-converted to USDC.</p>
            </div>

            {isWalletConnected ? (
                <div className="bg-surface/50 backdrop-blur-md border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                <Wallet className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Direct Deposit</h2>
                                <p className="text-sm text-white/50">{address?.slice(0, 8)}...{address?.slice(-6)}</p>
                            </div>
                        </div>
                        <button onClick={() => disconnect()} className="text-xs text-white/40 hover:text-white/70 transition-colors">
                            Disconnect
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-black/40 border border-white/10 rounded-xl p-4">
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-medium text-white/60">Amount (USDC)</label>
                                <button onClick={() => setDepositAmount(usdcBalance)} className="text-xs text-secondary hover:text-white cursor-pointer transition-colors">
                                    Balance: {usdcBalance}
                                </button>
                            </div>
                            <input
                                type="number"
                                value={depositAmount}
                                onChange={(e) => setDepositAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-transparent text-2xl font-mono text-white placeholder:text-white/20 focus:outline-none"
                            />
                        </div>

                        <button
                            onClick={handleDeposit}
                            disabled={!depositAmount || parseFloat(depositAmount) <= 0 || isProcessing}
                            className="w-full py-4 bg-green-500 hover:bg-green-400 disabled:bg-white/5 disabled:text-white/20 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            {isProcessing ? 'Processing...' : 'Approve & Deposit'}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            ) : isCustodial ? (
                <div className="bg-surface/50 backdrop-blur-md border border-white/10 rounded-2xl p-6 text-center">
                    <h2 className="text-lg font-bold text-white mb-4">Scan to Deposit</h2>
                    <div className="bg-white p-6 rounded-xl inline-block mb-6">
                        <QRCodeSVG value={address || ''} size={180} />
                    </div>
                    <div className="bg-black/40 border border-white/10 p-4 rounded-xl flex items-center justify-between mb-6 max-w-sm mx-auto">
                        <code className="text-primary font-mono text-sm break-all">{address}</code>
                        <button onClick={() => copyToClipboard(address || '')}>
                            {copied ? <CheckCircle size={18} className="text-success" /> : <Copy size={18} className="text-white/60" />}
                        </button>
                    </div>
                    <p className="text-white/40 text-sm">
                        Send any base token (BNB, USDT, USDC) on <strong className="text-white">BNB Chain</strong>.
                        <br />It will be automatically converted to USDC.
                    </p>
                </div>
            ) : (
                <div className="bg-surface/50 backdrop-blur-md border border-white/10 rounded-2xl p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
                        <Wallet className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Sign In or Connect Wallet</h2>
                    <p className="text-white/50 mb-6">Choose how you want to deposit funds</p>
                    <div className="flex gap-4 justify-center">
                        <button onClick={() => setShowLoginModal(true)} className="px-6 py-3 bg-primary hover:bg-primary/80 text-black font-bold rounded-xl transition-all">
                            Sign In
                        </button>
                        <button onClick={() => setShowWalletModal(true)} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all">
                            Connect Wallet
                        </button>
                    </div>
                </div>
            )}

            <WalletModal
                isOpen={showWalletModal}
                onClose={() => setShowWalletModal(false)}
                onSelectWallet={connect}
            />
            <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} onLogin={login} />
        </div>
    );
}
