"use client";

import { Copy, Wallet, CheckCircle, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { QRCodeSVG } from 'qrcode.react';
import { useWallet } from "@/lib/use-wallet";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { getContracts } from "@/lib/contracts";
import { checkAndSwitchNetwork } from "@/lib/web3";
import { Contract, ethers } from 'ethers';
import ConnectWalletModal from "@/components/wallet/ConnectWalletModal";
import { AlertModal } from "@/components/ui/AlertModal";
import { DepositSuccessModal } from "@/components/ui/DepositSuccessModal";

const ERC20_ABI = [
    { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
    { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
];

const ZAP_ABI = [
    { name: 'zapInToken', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'tokenIn', type: 'address' }, { name: 'amountIn', type: 'uint256' }, { name: 'minUSDC', type: 'uint256' }], outputs: [] },
];

const MARKET_ABI = [
    { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
];

// Mainnet Token Addresses (BSC)
const TOKENS = {
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
};

const getTokens = () => {
    const c = getContracts() as any;
    // Use env var or fall back to known Mainnet address
    const usdcAddr = (c.mockUSDC && c.mockUSDC !== '') ? c.mockUSDC : TOKENS.USDC;

    return [
        { symbol: 'USDC', address: usdcAddr, decimals: 18, direct: true }, // USDC is 18 decimals on BSC? No, check below.
        { symbol: 'USDT', address: TOKENS.USDT, decimals: 18, direct: false },
        { symbol: 'WBNB', address: TOKENS.WBNB, decimals: 18, direct: false },
    ];
};

export default function DepositPage() {
    const tokens = getTokens();
    const { isConnecting, address, isConnected, disconnect, connect } = useWallet();
    const [copied, setCopied] = useState(false);
    const [selectedToken, setSelectedToken] = useState(tokens[0]);
    const [tokenBalance, setTokenBalance] = useState('0.00');
    const [depositAmount, setDepositAmount] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showConnectModal, setShowConnectModal] = useState(false);

    // Modal State
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [modalError, setModalError] = useState({ title: '', message: '' });
    const [lastDeposit, setLastDeposit] = useState({ amount: '0', symbol: 'USDC', hash: '' });

    const contracts = getContracts() as any;
    const ZAP_CONTRACT = contracts.zap || '0x...';
    // Remove hardcoded fallback, strict config should handle it or it returns undefined which crashes (good for fail fast)
    // Actually getContracts() returns string | undefined. We should trust it or default to empty string to avoid crash but fail cleanly.
    const MARKET_CONTRACT = contracts.predictionMarketLMSR || contracts.predictionMarket || '';




    useEffect(() => {
        if (address) {
            fetchBalance();
        }
    }, [address, selectedToken]);

    async function fetchBalance() {
        if (!address) return;
        try {
            if (!window.ethereum) return;

            // Check network before trying to fetch
            // We use a silent check first to avoid spamming switch requests on load if possible, 
            // but for now let's just use the shared helper which might prompt.
            // Actually, for fetchBalance (auto-run), let's just check chainId without switching first.
            const provider = new ethers.BrowserProvider(window.ethereum as any);
            const network = await provider.getNetwork();
            // Dynamic Network Check
            const targetChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 56);
            if (Number(network.chainId) !== targetChainId) {
                console.warn("Wrong network detected. Skipping balance fetch.");
                return;
            }

            const tokenContract = new Contract(selectedToken.address, ERC20_ABI, provider);

            const balance = await tokenContract.balanceOf(address);
            const formattedBalance = ethers.formatUnits(balance, selectedToken.decimals);
            setTokenBalance(parseFloat(formattedBalance).toFixed(2));
        } catch (error: any) {
            console.error('Failed to fetch balance:', error);
            // Suppress the alert for balance fetching, it's annoying. Just log it.
            setTokenBalance('0.00');
        }
    }


    async function handleDeposit() {
        if (!address || !depositAmount || parseFloat(depositAmount) <= 0) return;
        setIsProcessing(true);
        try {
            if (!window.ethereum) {
                throw new Error('Please install MetaMask');
            }

            // Enforce Network Switch
            const isCorrectNetwork = await checkAndSwitchNetwork(window.ethereum);
            if (!isCorrectNetwork) {
                const targetName = process.env.NEXT_PUBLIC_NETWORK_NAME || 'BNB Chain';
                throw new Error(`Please switch to ${targetName} to deposit.`);
            }

            const provider = new ethers.BrowserProvider(window.ethereum as any);
            const signer = await provider.getSigner();

            console.log('Using token:', selectedToken.address);
            console.log('Deposit amount:', depositAmount, selectedToken.symbol);

            const tokenContract = new Contract(selectedToken.address, ERC20_ABI, signer);
            const amountInWei = ethers.parseUnits(depositAmount, selectedToken.decimals);

            // Check token balance
            const tokenBalance = await tokenContract.balanceOf(address);
            if (tokenBalance < amountInWei) {
                throw new Error(`Insufficient ${selectedToken.symbol} balance. You have ${ethers.formatUnits(tokenBalance, selectedToken.decimals)} ${selectedToken.symbol}`);
            }

            if (selectedToken.direct) {
                // Direct USDC deposit
                if (!MARKET_CONTRACT) {
                    throw new Error("Market contract address is missing in configuration. Please report this issue.");
                }
                console.log('Direct USDC deposit to market contract:', MARKET_CONTRACT);
                const marketContract = new Contract(MARKET_CONTRACT, MARKET_ABI, signer);

                // Check allowance and approve if needed
                const currentAllowance = await tokenContract.allowance(address, MARKET_CONTRACT);
                if (currentAllowance < amountInWei) {
                    console.log('Approving USDC spend...');
                    const approveTx = await tokenContract.approve(MARKET_CONTRACT, amountInWei);
                    await approveTx.wait();
                }

                // Deposit to market
                const depositTx = await marketContract.deposit(amountInWei);
                await depositTx.wait();

            } else {
                // Zap contract integration
                if (!ZAP_CONTRACT || ZAP_CONTRACT === '0x...') {
                    throw new Error("Zap contract address is missing or invalid. Please report this issue.");
                }
                console.log('Using Zap contract:', ZAP_CONTRACT);
                const zapContract = new Contract(ZAP_CONTRACT, ZAP_ABI, signer);

                // Approve Zap to spend tokens
                const currentAllowance = await tokenContract.allowance(address, ZAP_CONTRACT);
                if (currentAllowance < amountInWei) {
                    console.log('Approving Zap spend...');
                    const approveTx = await tokenContract.approve(ZAP_CONTRACT, amountInWei);
                    await approveTx.wait();
                }

                // Calculate minimum USDC with 5% slippage
                const estimatedUSDC = ethers.parseUnits((parseFloat(depositAmount) * 0.95).toString(), 6);

                // Zap in via swap
                console.log('Zapping token to USDC...');
                const zapTx = await zapContract.zapInToken(selectedToken.address, amountInWei, estimatedUSDC);
                await zapTx.wait();
            }

            setLastDeposit({
                amount: depositAmount,
                symbol: selectedToken.symbol,
                hash: (selectedToken.direct ? '' : '')
            });
            setSuccessModalOpen(true);
            setDepositAmount('');
            fetchBalance();

            // ... inside catch block ...
        } catch (error: any) {
            console.error('Deposit failed:', error);
            let errorMessage = 'Deposit failed';
            let errorTitle = 'Transaction Failed';

            if (error.code === 'ACTION_REJECTED') {
                errorMessage = 'Transaction was rejected by user';
                errorTitle = 'Action Rejected';
            } else if (error.message?.includes('could not decode result data')) {
                errorMessage = `The ${selectedToken.symbol} token contract is not responding.\n\nPossible issues:\n• Contract not deployed on BSC Testnet\n• Wrong network selected\n• Contract address incorrect`;
                errorTitle = 'Contract Error';
            } else if (error.message?.includes('insufficient funds')) {
                errorMessage = 'Insufficient funds for transaction cost';
                errorTitle = 'Insufficient Funds';
            } else if (error.message) {
                errorMessage = error.message.length > 100 ? error.message.substring(0, 100) + '...' : error.message;
            }

            setModalError({ title: errorTitle, message: errorMessage });
            setErrorModalOpen(true);
        } finally {
            setIsProcessing(false);
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (isConnecting) return <SkeletonLoader />;

    return (
        <div className="max-w-2xl mx-auto space-y-8 pt-8">
            <div className="text-center">
                <h1 className="text-3xl font-mono font-bold text-white mb-2">DEPOSIT FUNDS</h1>
                <p className="text-white/50">Add funds to start trading. Auto-converted to USDC.</p>
            </div>

            {isConnected ? (
                <div className="bg-surface/50 backdrop-blur-md border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                <Wallet className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Direct Deposit</h2>
                                <button
                                    onClick={() => address && copyToClipboard(address)}
                                    className="text-sm text-white/50 hover:text-white transition-colors flex items-center gap-2 group"
                                >
                                    {address?.slice(0, 8)}...{address?.slice(-6)}
                                    {copied ? (
                                        <span className="text-neon-green text-xs font-bold animate-pulse">COPIED!</span>
                                    ) : (
                                        <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    )}
                                </button>
                            </div>
                        </div>
                        <button onClick={() => disconnect()} className="text-xs text-white/40 hover:text-white/70 transition-colors">
                            Disconnect
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-black/40 border border-white/10 rounded-xl p-4">
                            <label className="text-sm font-medium text-white/60 mb-3 block">Select Token</label>
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                {tokens.map((token) => (
                                    <button
                                        key={token.symbol}
                                        onClick={() => setSelectedToken(token)}
                                        className={`py-2 px-3 rounded-lg font-bold transition-all border ${selectedToken.symbol === token.symbol
                                            ? 'bg-primary text-white border-primary shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                                            : 'bg-white/5 text-white/60 hover:bg-white/10 border-white/10 hover:border-white/20'
                                            }`}
                                    >
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="flex items-center gap-1">
                                                <span className="text-sm">{token.symbol}</span>
                                                {selectedToken.symbol === token.symbol && (
                                                    <CheckCircle className="w-3 h-3" />
                                                )}
                                            </div>
                                            <span className="text-xs opacity-60">
                                                {token.direct ? 'Direct' : 'Swap'}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <div className="text-xs text-white/40 text-center">
                                Selected: <span className="text-primary font-bold">{selectedToken.symbol}</span>
                                {selectedToken.direct ? ' (Direct)' : ' (Auto-converted to USDC)'}
                            </div>
                        </div>

                        <div className="bg-black/40 border border-white/10 rounded-xl p-4">
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-medium text-white/60">Amount ({selectedToken.symbol})</label>
                                <div className="flex gap-2">
                                    <button onClick={() => setDepositAmount(tokenBalance)} className="text-xs text-secondary hover:text-white cursor-pointer transition-colors">
                                        Balance: {tokenBalance}
                                    </button>

                                </div>
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
                            {isProcessing ? 'Processing...' : selectedToken.direct ? 'Approve & Deposit' : 'Approve & Swap to USDC'}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="bg-surface/50 backdrop-blur-md border border-white/10 rounded-2xl p-8 text-center">
                        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
                            <Wallet className="w-8 h-8 text-primary" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Deposit Funds</h2>
                        <p className="text-white/50 mb-6">Connect your wallet to deposit and start trading</p>
                        <button
                            onClick={() => setShowConnectModal(true)}
                            className="px-6 py-3 bg-primary hover:bg-primary/80 text-black font-bold rounded-xl transition-all"
                        >
                            Connect Wallet
                        </button>
                    </div>

                    <ConnectWalletModal
                        isOpen={showConnectModal}
                        onClose={() => setShowConnectModal(false)}
                        onConnect={connect}
                        context="deposit"
                    />
                </>
            )}
            {/* Modals */}
            <DepositSuccessModal
                isOpen={successModalOpen}
                onClose={() => setSuccessModalOpen(false)}
                amount={lastDeposit.amount}
                symbol={lastDeposit.symbol}
                txHash={lastDeposit.hash}
            />

            <AlertModal
                isOpen={errorModalOpen}
                onClose={() => setErrorModalOpen(false)}
                title={modalError.title}
                message={modalError.message}
                type="error"
            />
        </div>
    );
}
