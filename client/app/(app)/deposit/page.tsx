"use client";

import { Copy, Wallet, CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useWallet } from "@/lib/use-wallet";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { getContracts, NETWORK } from "@/lib/contracts";
import { Contract, ethers } from 'ethers';
import { useConnectorClient, useAccount } from 'wagmi';
import ConnectWalletModal from "@/components/wallet/ConnectWalletModal";
import { AlertModal } from "@/components/ui/AlertModal";
import { DepositSuccessModal } from "@/components/ui/DepositSuccessModal";
import { clientToSigner } from "@/lib/viem-ethers-adapters";
import { QRCodeSVG } from 'qrcode.react';

const ERC20_ABI = [
    { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
    { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
];

const ZAP_ABI = [
    { name: 'zapInToken', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'tokenIn', type: 'address' }, { name: 'amountIn', type: 'uint256' }, { name: 'minUSDC', type: 'uint256' }], outputs: [] },
    { name: 'zapInBNB', type: 'function', stateMutability: 'payable', inputs: [{ name: 'minUSDC', type: 'uint256' }], outputs: [] },
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
    // STABLE CONFIGURATION:
    // Market contract was deployed with USDC as collateral
    const baseCollateral = TOKENS.USDC.toLowerCase();
    const tokenUSDT = TOKENS.USDT.toLowerCase();
    const tokenUSDC = TOKENS.USDC.toLowerCase();

    const isUSDTDirect = tokenUSDT === baseCollateral;
    const isUSDCDirect = tokenUSDC === baseCollateral;

    return [
        { symbol: 'USDT', address: TOKENS.USDT, decimals: 18, direct: isUSDTDirect, comingSoon: false, isNative: false },
        { symbol: 'USDC', address: TOKENS.USDC, decimals: 18, direct: isUSDCDirect, comingSoon: false, isNative: false },
        { symbol: 'BNB', address: TOKENS.WBNB, decimals: 18, direct: false, comingSoon: false, isNative: true }, // Native BNB
        { symbol: 'BC400', address: process.env.NEXT_PUBLIC_BC400_CONTRACT || '0xB929177331De755d7aCc5665267a247e458bCdeC', decimals: 18, direct: false, comingSoon: true, isNative: false },
    ];
};

import { usePrivy, useWallets } from "@privy-io/react-auth";

export default function DepositPage() {
    const tokens = getTokens();
    const { isConnecting, address, isConnected, disconnect, connect } = useWallet();
    const { data: connectorClient } = useConnectorClient();
    const { connector } = useAccount();
    const { user, authenticated, createWallet, ready } = usePrivy();
    const { wallets, ready: walletsReady } = useWallets();

    const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');

    // Effective connection state (Standard OR Embedded)
    const isEffectivelyConnected = isConnected || authenticated;
    const effectiveAddress = address || user?.wallet?.address || embeddedWallet?.address;

    useEffect(() => {
        console.log('[DepositPage Debug] State:', {
            isConnected,
            authenticated,
            isEffectivelyConnected,
            address,
            privyWallet: user?.wallet,
            embeddedWallet,
            walletsLength: wallets.length,
            wallets: wallets.map(w => ({ type: w.walletClientType, address: w.address })),
            effectiveAddress
        });
    }, [isConnected, authenticated, address, user, effectiveAddress, wallets, embeddedWallet]);

    // Auto-create wallet if authenticated but missing
    useEffect(() => {
        if (authenticated && !user?.wallet && !embeddedWallet && !address) {
            console.log('[DepositPage] No wallet found for authenticated user. Attempting to create...');
            createWallet().catch(err => console.error('[DepositPage] Failed to create wallet:', err));
        }
    }, [authenticated, user, embeddedWallet, address, createWallet]);

    // Detect Embedded Wallet (Privy) - Robust Check
    // We treat the user as "Embedded/Smart Wallet" if:
    // 1. They are authenticated via Privy AND have Google/Email/Twitter linked (Social Login)
    // 2. Their connected wallet is explicitly 'privy'
    const isEmbeddedWallet =
        (authenticated && (!!user?.google || !!user?.email || !!user?.twitter || !!user?.discord)) ||
        user?.wallet?.walletClientType === 'privy' ||
        connector?.id === 'privy' ||
        connector?.name?.toLowerCase().includes('privy') ||
        connector?.name?.toLowerCase().includes('embedded');

    const [copied, setCopied] = useState(false);
    const [selectedToken, setSelectedToken] = useState(tokens[0]);
    const isUSDTDirect = tokens.find(t => t.symbol === 'USDT')?.direct || false;
    const [tokenBalance, setTokenBalance] = useState<string | null>(null);
    const [depositAmount, setDepositAmount] = useState('');
    const [gameBalance, setGameBalance] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showConnectModal, setShowConnectModal] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    // Seamless Flow State
    const [fundingStep, setFundingStep] = useState<'input' | 'payment' | 'verifying' | 'depositing'>('input');
    const [initialBalance, setInitialBalance] = useState('0.00');

    // Modal State
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [modalError, setModalError] = useState({ title: '', message: '' });
    const [lastDeposit, setLastDeposit] = useState({ amount: '0', symbol: 'USDT', hash: '' });

    const contracts = getContracts() as any;
    const ZAP_CONTRACT = contracts.zap || process.env.NEXT_PUBLIC_ZAP_ADDRESS || '';
    const MARKET_CONTRACT = process.env.NEXT_PUBLIC_MARKET_ADDRESS || contracts.predictionMarket || '';

    useEffect(() => {
        if (effectiveAddress) {
            fetchBalance();
            fetchGameBalance();
        }
    }, [effectiveAddress, selectedToken]);

    // Polling for "Verifying" step
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (fundingStep === 'verifying' && effectiveAddress) {
            interval = setInterval(async () => {
                await checkAndAutoDeposit();
            }, 3000); // Poll every 3s
        }
        return () => clearInterval(interval);
    }, [fundingStep, effectiveAddress, initialBalance, depositAmount]);

    async function fetchBalance() {
        if (!effectiveAddress) return;

        try {
            const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed.binance.org/';
            // console.log('[Deposit] Fetching balance for:', { address: effectiveAddress, token: selectedToken.symbol });

            const provider = new ethers.JsonRpcProvider(rpcUrl);

            let formattedBalance = '0.00';
            if (selectedToken.isNative) {
                const balance = await provider.getBalance(effectiveAddress);
                formattedBalance = ethers.formatEther(balance);
            } else {
                const tokenContract = new Contract(selectedToken.address, ERC20_ABI, provider);
                const balance = await tokenContract.balanceOf(effectiveAddress);
                formattedBalance = ethers.formatUnits(balance, selectedToken.decimals);
            }

            setTokenBalance(parseFloat(formattedBalance).toFixed(4));

            // If we are in 'input' step, capture this as the baseline for change detection
            if (fundingStep === 'input') {
                setInitialBalance(formattedBalance);
            }

        } catch (error: any) {
            console.error('[Deposit] Failed to fetch balance:', error);
            setTokenBalance('0.00');
        }
    }

    async function fetchGameBalance() {
        if (!effectiveAddress) return;

        try {
            const { web3Service } = await import('@/lib/web3');
            const balance = await web3Service.getDepositedBalance(effectiveAddress);
            setGameBalance(parseFloat(balance).toFixed(2));
        } catch (error: any) {
            console.error('[Deposit] Failed to fetch game balance:', error);
            setGameBalance('0.00');
        }
    }

    async function checkAndAutoDeposit() {
        if (!effectiveAddress || !depositAmount) return;

        try {
            const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed.binance.org/';
            const provider = new ethers.JsonRpcProvider(rpcUrl);

            // Check current balance
            let currentBal = 0;
            if (selectedToken.isNative) {
                const bal = await provider.getBalance(effectiveAddress);
                currentBal = parseFloat(ethers.formatEther(bal));
            } else {
                const tokenContract = new Contract(selectedToken.address, ERC20_ABI, provider);
                const bal = await tokenContract.balanceOf(effectiveAddress);
                currentBal = parseFloat(ethers.formatUnits(bal, selectedToken.decimals));
            }

            console.log(`[Polling] Current: ${currentBal}, Required: ${parseFloat(depositAmount)}`);

            // If we have enough funds (current balance >= amount requested)
            if (currentBal >= parseFloat(depositAmount)) {
                console.log('Funds Detected! Auto-depositing...');
                setFundingStep('depositing');
                handleDeposit(); // Trigger normal deposit
            }

        } catch (e) {
            console.error('Polling error:', e);
        }
    }

    async function handleDeposit() {
        if (!effectiveAddress || !depositAmount || parseFloat(depositAmount) <= 0) return;
        setIsProcessing(true);
        setStatusMessage('Preparing transaction...');

        try {
            if (!connectorClient) {
                throw new Error('Wallet not ready. Please verify your connection.');
            }

            const signer = clientToSigner(connectorClient);
            const amountInWei = ethers.parseUnits(depositAmount, selectedToken.decimals);

            // ... (rest of standard deposit logic reused)

            // Check balance first
            const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed.binance.org/';
            const publicProvider = new ethers.JsonRpcProvider(rpcUrl);

            // ... (reusing existing checks)
            let currentBalance;
            if (selectedToken.isNative) {
                currentBalance = await publicProvider.getBalance(effectiveAddress);
                // Leave some gas buffer for BNB transactions (0.001 BNB ~ $0.96)
                const gasBuffer = ethers.parseEther("0.001");
                if (currentBalance < (amountInWei + gasBuffer)) {
                    throw new Error(`Insufficient BNB balance. Need ${depositAmount} + gas.`);
                }
            } else {
                const tokenContract = new Contract(selectedToken.address, ERC20_ABI, publicProvider);
                currentBalance = await tokenContract.balanceOf(address);
                if (currentBalance < amountInWei) {
                    throw new Error(`Insufficient ${selectedToken.symbol} balance.`);
                }
            }


            if (selectedToken.direct) {
                // Direct USDT/USDC deposit
                if (!MARKET_CONTRACT) {
                    throw new Error("Market contract address is missing in configuration.");
                }

                // Use public provider for reading allowance
                const readProvider = new ethers.JsonRpcProvider(rpcUrl);
                const tokenContractRead = new Contract(selectedToken.address, ERC20_ABI, readProvider);
                const tokenContract = new Contract(selectedToken.address, ERC20_ABI, signer);
                const marketContract = new Contract(MARKET_CONTRACT, MARKET_ABI, signer);

                const currentAllowance = await tokenContractRead.allowance(address, MARKET_CONTRACT);
                if (currentAllowance < amountInWei) {
                    setStatusMessage('Approving token...');
                    const approveTx = await tokenContract.approve(MARKET_CONTRACT, amountInWei);
                    await approveTx.wait();
                }

                setStatusMessage('Depositing...');
                const depositTx = await marketContract.deposit(amountInWei);
                await depositTx.wait();

            } else {
                // Zap Logic
                if (!ZAP_CONTRACT) throw new Error("Zap contract invalid.");
                const zapContract = new Contract(ZAP_CONTRACT, ZAP_ABI, signer);
                const estimatedMain = ethers.parseUnits((parseFloat(depositAmount) * 0.95).toString(), 18);

                if (selectedToken.isNative) {
                    setStatusMessage('Zapping BNB...');
                    const zapTx = await zapContract.zapInBNB(estimatedMain, { value: amountInWei });
                    await zapTx.wait();
                } else {
                    const tokenToZap = selectedToken.address;
                    const tokenContract = new Contract(tokenToZap, ERC20_ABI, signer);
                    const readProvider = new ethers.JsonRpcProvider(rpcUrl);
                    const tokenContractRead = new Contract(tokenToZap, ERC20_ABI, readProvider);

                    const currentAllowance = await tokenContractRead.allowance(address, ZAP_CONTRACT);

                    if (currentAllowance < amountInWei) {
                        setStatusMessage(`Approving ${selectedToken.symbol}...`);
                        const approveTx = await tokenContract.approve(ZAP_CONTRACT, amountInWei);
                        await approveTx.wait();
                    }

                    setStatusMessage('Zapping...');
                    const zapTx = await zapContract.zapInToken(tokenToZap, amountInWei, estimatedMain);
                    await zapTx.wait();
                }
            }

            setLastDeposit({
                amount: depositAmount,
                symbol: selectedToken.symbol,
                hash: ''
            });
            setSuccessModalOpen(true);
            setDepositAmount('');
            setFundingStep('input'); // Reset flow
            fetchBalance();
            fetchGameBalance(); // Refresh game balance

        } catch (error: any) {
            console.error('Deposit failed:', error);
            // Error handling ...
            let errorMessage = error.message || 'Deposit failed';

            // Basic error parsing (simplified for brevity, matching existing logic)
            if (error.code === 'ACTION_REJECTED' || error.message?.includes('user rejected')) {
                errorMessage = 'Transaction rejected';
            } else if (error.message?.includes('insufficient funds')) {
                errorMessage = 'Insufficient funds';
            }

            setModalError({ title: 'Transaction Failed', message: errorMessage });
            setErrorModalOpen(true);

            // If we were in verifying/depositing mode, go back to input or retry?
            if (fundingStep === 'depositing') setFundingStep('verifying'); // Keep checking? Or 'payment'?
            else setFundingStep('input');
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

    const isAuthLoading = !ready || (authenticated && !walletsReady);
    const isBalanceLoading = isEffectivelyConnected && !!effectiveAddress && (tokenBalance === null || gameBalance === null);

    // FIX: If we are effectively connected, we shouldn't block on isConnecting/isAuthLoading
    // This prevents infinite loading if the wallet adapter is slow to report "ready"
    const isLoadingState = (!isEffectivelyConnected && (isConnecting || isAuthLoading)) || isBalanceLoading;

    if (isLoadingState) return <SkeletonLoader />;

    return (
        <div className="max-w-2xl mx-auto space-y-8 pt-8 pb-32">
            <div className="text-center">
                <h1 className="text-3xl font-mono font-bold text-white mb-2">
                    {isEmbeddedWallet ? 'FUND ACCOUNT' : 'DEPOSIT FUNDS'}
                </h1>
                <p className="text-white/50">
                    {isEmbeddedWallet ? 'Add funds to your account to start playing.' : 'Add funds to start trading.'}
                </p>
            </div>

            {isEffectivelyConnected ? (
                <div className="bg-surface/50 backdrop-blur-md border border-white/10 rounded-2xl p-6">

                    {/* Header / Wallet Info */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                <Wallet className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">
                                    {isEmbeddedWallet ? 'Smart Balance' : 'Direct Deposit'}
                                </h2>
                                <button
                                    onClick={() => effectiveAddress && copyToClipboard(effectiveAddress)}
                                    className="text-sm text-white/50 hover:text-white transition-colors flex items-center gap-2 group"
                                >
                                    {effectiveAddress?.slice(0, 8)}...{effectiveAddress?.slice(-6)}
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

                    {/* Game Balance Display */}
                    <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 mb-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-white/60">Game Balance</span>
                            <span className="text-2xl font-mono font-bold text-green-500">${gameBalance || '0.00'}</span>
                        </div>
                        <p className="text-xs text-white/40 mt-1">This is your deposited balance. Use this to bet!</p>
                    </div>

                    {/* CONTENT AREA */}
                    {isEmbeddedWallet ? (
                        // --- EMBEDDED WALLET FLOW ---
                        <div className="space-y-6">

                            {/* Step Indicator */}
                            {fundingStep !== 'input' && (
                                <div className="text-center mb-4">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs">
                                        <span className={fundingStep === 'payment' ? 'text-primary' : 'text-white/50'}>1. Send</span>
                                        <span className="text-white/20">→</span>
                                        <span className={fundingStep === 'verifying' ? 'text-primary' : 'text-white/50'}>2. Verify</span>
                                        <span className="text-white/20">→</span>
                                        <span className={fundingStep === 'depositing' ? 'text-primary' : 'text-white/50'}>3. Play</span>
                                    </div>
                                </div>
                            )}

                            {fundingStep === 'input' && (
                                <div className="bg-black/40 border border-white/10 rounded-xl p-6 text-center">
                                    <h3 className="text-white font-bold mb-4">How much do you want to play with?</h3>
                                    <div className="relative max-w-xs mx-auto mb-6">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">$</span>
                                        <input
                                            type="number"
                                            value={depositAmount}
                                            onChange={(e) => setDepositAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-8 pr-4 text-2xl font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-primary text-center"
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (parseFloat(depositAmount) > 0) setFundingStep('payment');
                                        }}
                                        disabled={!depositAmount || parseFloat(depositAmount) <= 0}
                                        className="w-full py-4 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        Continue
                                    </button>
                                </div>
                            )}

                            {fundingStep === 'payment' && (
                                <div className="bg-black/40 border border-white/10 rounded-xl p-6 text-center animate-fadeIn">
                                    <p className="text-white/70 mb-2">Send exactly</p>
                                    <h3 className="text-3xl font-mono font-bold text-green-500 mb-1">{depositAmount} <span className="text-sm text-white/60">USDC or USDT</span></h3>
                                    <p className="text-white/40 text-sm mb-6">to your personal address below (BNB Chain)</p>

                                    {/* QR Code */}
                                    <div className="bg-white p-4 rounded-xl mb-4 inline-block">
                                        <QRCodeSVG
                                            value={effectiveAddress || ''}
                                            size={200}
                                            level="H"
                                            includeMargin={true}
                                        />
                                    </div>
                                    <p className="text-xs text-white/40 mb-6">Scan with your wallet app</p>

                                    <div className="bg-white/5 p-4 rounded-xl border border-white/10 mb-6 flex items-center justify-between gap-2 overflow-hidden">
                                        <code className="text-sm font-mono text-white truncate">{effectiveAddress}</code>
                                        <button onClick={() => effectiveAddress && copyToClipboard(effectiveAddress)} className="p-2 hover:bg-white/10 rounded-lg text-green-500">
                                            <Copy className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg mb-6 text-xs text-blue-200">
                                        Send from Binance, Coinbase, or any external wallet on <strong>BNB Smart Chain (BEP20)</strong>.
                                    </div>

                                    <div className="flex gap-3">
                                        <button onClick={() => setFundingStep('input')} className="flex-1 py-3 bg-white/5 text-white/50 hover:text-white rounded-xl">Back</button>
                                        <button
                                            onClick={() => setFundingStep('verifying')}
                                            className="flex-[2] py-3 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400"
                                        >
                                            I Have Sent It
                                        </button>
                                    </div>
                                </div>
                            )}

                            {fundingStep === 'verifying' && (
                                <div className="bg-black/40 border border-white/10 rounded-xl p-8 text-center animate-fadeIn">
                                    <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
                                    <h3 className="text-xl font-bold text-white mb-2">Checking for Funds...</h3>
                                    <p className="text-white/50 text-sm mb-6">This usually takes 10-30 seconds.</p>
                                    <div className="w-full bg-white/5 rounded-full h-1 mb-2 overflow-hidden">
                                        <div className="h-full bg-primary/50 animate-progress"></div>
                                    </div>
                                    <p className="text-xs text-white/30">Auto-refreshing balance...</p>
                                    <button onClick={() => setFundingStep('input')} className="mt-6 text-xs text-white/40 hover:text-white">Cancel</button>
                                </div>
                            )}

                            {fundingStep === 'depositing' && (
                                <div className="bg-black/40 border border-white/10 rounded-xl p-8 text-center animate-fadeIn">
                                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4 animate-bounce" />
                                    <h3 className="text-xl font-bold text-white mb-2">Funds Received!</h3>
                                    <p className="text-white/50 text-sm">Depositing into game...</p>
                                </div>
                            )}

                        </div>
                    ) : (
                        // --- STANDARD EXTERNAL WALLET FLOW ---
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
                                    {selectedToken.direct ? ' (Direct)' : ` (Auto-converted to ${isUSDTDirect ? 'USDT' : 'USDC'})`}
                                </div>
                            </div>

                            <div className="bg-black/40 border border-white/10 rounded-xl p-4">
                                <div className="flex justify-between mb-2">
                                    <label className="text-sm font-medium text-white/60">Amount ({selectedToken.symbol})</label>
                                    <div className="flex gap-2">
                                        <button onClick={() => setDepositAmount(tokenBalance || '0.00')} className="text-xs text-secondary hover:text-white cursor-pointer transition-colors">
                                            Balance: {tokenBalance || '0.00'}
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
                                {selectedToken.comingSoon ? '🚀 Coming Soon' : isProcessing ? 'Processing Transaction...' : selectedToken.direct ? 'Approve & Deposit' : `Approve & Swap to ${isUSDTDirect ? 'USDT' : 'USDC'}`}
                                {!selectedToken.comingSoon && !isProcessing && <ArrowRight className="w-5 h-5" />}
                            </button>
                        </div>
                    )}
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
                            Log In
                        </button>
                    </div>

                    <ConnectWalletModal
                        isOpen={showConnectModal}
                        onClose={() => setShowConnectModal(false)}
                        onConnect={connect}
                        context="deposit"
                    />
                </>
            )
            }
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
        </div >
    );
}
