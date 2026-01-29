"use client";

import { Copy, Wallet, CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useWallet } from "@/lib/use-wallet";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { getContracts, NETWORK } from "@/lib/contracts";
import { Contract, ethers } from 'ethers';
import { useConnectorClient } from 'wagmi';
import ConnectWalletModal from "@/components/wallet/ConnectWalletModal";
import { AlertModal } from "@/components/ui/AlertModal";
import { DepositSuccessModal } from "@/components/ui/DepositSuccessModal";
import { clientToSigner } from "@/lib/viem-ethers-adapters";

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
    USDT: process.env.NEXT_PUBLIC_USDT_CONTRACT || '0x55d398326f99059fF775485246999027B3197955', // Fallback to Binance-Peg BSC-USD
    USDC: process.env.NEXT_PUBLIC_USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // Fallback to Native BSC-USD
    WBNB: process.env.NEXT_PUBLIC_WBNB_CONTRACT || '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'  // Fallback to WBNB
};

const getTokens = () => {
    const c = getContracts() as any;
    // The market's base token (collateral)
    const marketToken = (c.mockUSDC || c.usdc || '').toLowerCase();

    // Determine which token is "Direct" (must match market collat)
    const isUSDTDirect = marketToken === TOKENS.USDT.toLowerCase();
    const isUSDCDirect = marketToken === TOKENS.USDC.toLowerCase();

    return [
        { symbol: 'USDT', address: TOKENS.USDT, decimals: 18, direct: isUSDTDirect, comingSoon: false },
        { symbol: 'USDC', address: TOKENS.USDC, decimals: 18, direct: isUSDCDirect, comingSoon: false },
        { symbol: 'WBNB', address: TOKENS.WBNB, decimals: 18, direct: false, comingSoon: false },
        { symbol: 'BC400', address: process.env.NEXT_PUBLIC_BC400_CONTRACT || '0xB929177331De755d7aCc5665267a247e458bCdeC', decimals: 18, direct: false, comingSoon: true },
    ];
};

export default function DepositPage() {
    const tokens = getTokens();
    const { isConnecting, address, isConnected, disconnect, connect } = useWallet();
    const { data: connectorClient } = useConnectorClient();
    const [copied, setCopied] = useState(false);
    const [selectedToken, setSelectedToken] = useState(tokens[0]);
    const [tokenBalance, setTokenBalance] = useState('0.00');
    const [depositAmount, setDepositAmount] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showConnectModal, setShowConnectModal] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    // Modal State
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [modalError, setModalError] = useState({ title: '', message: '' });
    const [lastDeposit, setLastDeposit] = useState({ amount: '0', symbol: 'USDT', hash: '' });

    const contracts = getContracts() as any;
    const ZAP_CONTRACT = contracts.zap || '0x...';
    const MARKET_CONTRACT = contracts.predictionMarketLMSR || contracts.predictionMarket || '';

    useEffect(() => {
        if (address && connectorClient) {
            fetchBalance();
        }
    }, [address, selectedToken, connectorClient]);

    async function fetchBalance() {
        if (!address) return;

        try {
            let provider;
            let contractUser = address;

            const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed.binance.org/';
            console.log('[Deposit] Fetching balance for:', { address, token: selectedToken.symbol, tokenAddr: selectedToken.address });

            if (connectorClient) {
                console.log('[Deposit] Using Wallet Signer');
                const signer = clientToSigner(connectorClient);
                provider = signer;
            } else {
                console.log('[Deposit] Using Public Provider:', rpcUrl);
                // Fallback to Read-Only Provider
                // This handles cases where useWallet has an address (cached) but Wagmi isn't fully active
                provider = new ethers.JsonRpcProvider(rpcUrl);
            }

            const tokenContract = new Contract(selectedToken.address, ERC20_ABI, provider);

            // Debug contract call
            console.log('[Deposit] Calling balanceOf...');
            const balance = await tokenContract.balanceOf(contractUser);
            console.log('[Deposit] Raw Balance:', balance.toString());

            const formattedBalance = ethers.formatUnits(balance, selectedToken.decimals);
            console.log('[Deposit] Formatted Balance:', formattedBalance);

            setTokenBalance(parseFloat(formattedBalance).toFixed(2));
        } catch (error: any) {
            console.error('[Deposit] Failed to fetch balance:', error);
            setTokenBalance('0.00');
        }
    }


    async function handleDeposit() {
        if (!address || !depositAmount || parseFloat(depositAmount) <= 0) return;
        setIsProcessing(true);
        setStatusMessage('Preparing transaction...');

        try {
            if (!connectorClient) {
                throw new Error('Wallet not ready. Please verify your connection.');
            }

            const signer = clientToSigner(connectorClient);
            const amountInWei = ethers.parseUnits(depositAmount, selectedToken.decimals);

            console.log('Using token:', selectedToken.symbol, selectedToken.address);
            console.log('Is Native?', selectedToken.isNative);

            // Check balance first
            let currentBalance;
            if (selectedToken.isNative) {
                currentBalance = await signer.provider.getBalance(address);
                // Leave some gas buffer for BNB transactions (0.005 BNB)
                const gasBuffer = ethers.parseEther("0.005");
                if (currentBalance < (amountInWei + gasBuffer)) {
                    throw new Error(`Insufficient BNB balance. Need ${depositAmount} + gas.`);
                }
            } else {
                const tokenContract = new Contract(selectedToken.address, ERC20_ABI, signer);
                currentBalance = await tokenContract.balanceOf(address);
                if (currentBalance < amountInWei) {
                    throw new Error(`Insufficient ${selectedToken.symbol} balance.`);
                }
            }


            if (selectedToken.direct) {
                // Direct USDT/USDC deposit
                if (!MARKET_CONTRACT) {
                    throw new Error("Market contract address is missing in configuration. Please report this issue.");
                }
                setStatusMessage(`Approving ${selectedToken.symbol}...`);

                const tokenContract = new Contract(selectedToken.address, ERC20_ABI, signer);
                const marketContract = new Contract(MARKET_CONTRACT, MARKET_ABI, signer);

                // Check allowance and approve if needed
                const currentAllowance = await tokenContract.allowance(address, MARKET_CONTRACT);
                if (currentAllowance < amountInWei) {
                    console.log('Approving token spend...');
                    setStatusMessage('Please sign approval in wallet...');
                    const approveTx = await tokenContract.approve(MARKET_CONTRACT, amountInWei);
                    setStatusMessage('Waiting for approval confirmation...');
                    await approveTx.wait();
                }

                // Deposit to market
                setStatusMessage('Please sign deposit in wallet...');
                const depositTx = await marketContract.deposit(amountInWei);

                setStatusMessage('Confirming deposit...');
                await depositTx.wait();

            } else {
                // Zap contract integration
                if (!ZAP_CONTRACT || ZAP_CONTRACT === '0x...') {
                    throw new Error("Zap contract address is missing or invalid.");
                }

                // 1. If Native BNB -> Wrap to WBNB first
                if (selectedToken.isNative) {
                    setStatusMessage('Wrapping BNB to WBNB...');
                    // Use WETH ABI with the WBNB address
                    const wbnbContract = new Contract(selectedToken.address, WETH_ABI, signer);

                    // Wrap BNB (Deposit ETH to get WETH/WBNB)
                    console.log('Wrapping BNB...', amountInWei.toString());
                    const wrapTx = await wbnbContract.deposit({ value: amountInWei });
                    setStatusMessage('Confirming wrap...');
                    await wrapTx.wait();
                }

                // 2. ZapInToken (Now using WBNB or original ERC20)
                // Note: For BNB, selectedToken.address IS ALREADY the WBNB address
                const tokenToZap = selectedToken.address;
                const tokenContract = new Contract(tokenToZap, selectedToken.isNative ? WETH_ABI : ERC20_ABI, signer);
                const zapContract = new Contract(ZAP_CONTRACT, ZAP_ABI, signer);

                // Approve Zap to spend tokens (WBNB or ERC20)
                const currentAllowance = await tokenContract.allowance(address, ZAP_CONTRACT);
                if (currentAllowance < amountInWei) {
                    setStatusMessage(`Approving ${selectedToken.symbol} for Zap...`);
                    const approveTx = await tokenContract.approve(ZAP_CONTRACT, amountInWei);
                    setStatusMessage('Waiting for approval confirmation...');
                    await approveTx.wait();
                }

                // Calculate minimum USDT with 5% slippage
                // Use 18 decimals for USDT on BSC!
                const estimatedMain = ethers.parseUnits((parseFloat(depositAmount) * 0.95).toString(), 18);

                // Zap in via swap
                setStatusMessage('Please sign Zap transaction...');
                const zapTx = await zapContract.zapInToken(tokenToZap, amountInWei, estimatedMain);

                setStatusMessage('Processing swap...');
                await zapTx.wait();
            }

            setLastDeposit({
                amount: depositAmount,
                symbol: selectedToken.symbol,
                hash: '' // We could capture hash but simple success is likely enough
            });
            setSuccessModalOpen(true);
            setDepositAmount('');
            fetchBalance();

        } catch (error: any) {
            console.error('Deposit failed:', error);
            let errorMessage = 'Deposit failed';
            let errorTitle = 'Transaction Failed';

            // Basic error parsing
            if (error.code === 'ACTION_REJECTED' || error.message?.includes('user rejected') || error.message?.includes('User denied')) {
                errorMessage = 'Transaction was rejected by user';
                errorTitle = 'Action Rejected';
            } else if (error.message?.includes('could not decode result data')) {
                errorMessage = `The ${selectedToken.symbol} contract is not responding.\n\nCheck network.`;
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
            setStatusMessage('');
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
                <p className="text-white/50">Add funds to start trading. Auto-converted to USDT.</p>
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
                                        onClick={() => !token.comingSoon && setSelectedToken(token)}
                                        disabled={token.comingSoon}
                                        className={`py-2 px-3 rounded-lg font-bold transition-all border ${token.comingSoon
                                            ? 'bg-white/5 text-white/30 border-white/10 cursor-not-allowed'
                                            : selectedToken.symbol === token.symbol
                                                ? 'bg-primary text-white border-primary shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                                                : 'bg-white/5 text-white/60 hover:bg-white/10 border-white/10 hover:border-white/20'
                                            }`}
                                    >
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="flex items-center gap-1">
                                                <span className="text-sm">{token.symbol}</span>
                                                {selectedToken.symbol === token.symbol && !token.comingSoon && (
                                                    <CheckCircle className="w-3 h-3" />
                                                )}
                                            </div>
                                            <span className={`text-xs ${token.comingSoon ? 'text-amber-400 font-bold' : 'opacity-60'}`}>
                                                {token.comingSoon ? 'Coming Soon' : token.direct ? 'Direct' : 'Swap'}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <div className="text-xs text-white/40 text-center">
                                Selected: <span className="text-primary font-bold">{selectedToken.symbol}</span>
                                {selectedToken.direct ? ' (Direct)' : ' (Auto-converted to USDT)'}
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

                        {/* Status Message */}
                        {isProcessing && (
                            <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-center justify-center gap-3 animate-pulse">
                                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                <span className="text-primary text-sm font-bold">{statusMessage || 'Processing...'}</span>
                            </div>
                        )}

                        <button
                            onClick={handleDeposit}
                            disabled={!depositAmount || parseFloat(depositAmount) <= 0 || isProcessing || selectedToken.comingSoon}
                            className="w-full py-4 bg-green-500 hover:bg-green-400 disabled:bg-white/5 disabled:text-white/20 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            {selectedToken.comingSoon ? '🚀 Coming Soon' : isProcessing ? 'Processing Transaction...' : selectedToken.direct ? 'Approve & Deposit' : 'Approve & Swap to USDT'}
                            {!selectedToken.comingSoon && !isProcessing && <ArrowRight className="w-5 h-5" />}
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
