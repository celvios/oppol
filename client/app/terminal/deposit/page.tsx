"use client";

import { Copy, Wallet, CheckCircle, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { QRCodeSVG } from 'qrcode.react';
import { useWallet } from "@/lib/use-wallet";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { getContracts } from "@/lib/contracts";
import { Contract, ethers } from 'ethers';

const ERC20_ABI = [
    { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
    { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
];

const ZAP_ABI = [
    { name: 'zapInToken', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'tokenIn', type: 'address' }, { name: 'amountIn', type: 'uint256' }, { name: 'minUSDC', type: 'uint256' }], outputs: [] },
];

const MARKET_ABI = [
    { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
];

const STABLECOINS = [
    { symbol: 'USDC', address: '0x87D45E316f5f1f2faffCb600c97160658B799Ee0', decimals: 6, direct: true }, // MockUSDC - direct deposit
];

export default function DepositPage() {
    const { isConnecting, address, isConnected, disconnect, connect } = useWallet();
    const [copied, setCopied] = useState(false);
    const [selectedToken, setSelectedToken] = useState(STABLECOINS[0]);
    const [tokenBalance, setTokenBalance] = useState('0.00');
    const [depositAmount, setDepositAmount] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const contracts = getContracts() as any;
    const ZAP_CONTRACT = contracts.zap || '0x...';
    const MARKET_CONTRACT = contracts.predictionMarketLMSR || contracts.predictionMarket || '0x58c957342B8cABB9bE745BeBc09C267b70137959';

    async function mintTestTokens() {
        if (!address) return;
        try {
            if (!window.ethereum) {
                throw new Error('Please install MetaMask');
            }

            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            
            // MockUSDC contract has a mint function for testing
            const MINT_ABI = [
                { name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
            ];
            
            const tokenContract = new Contract(selectedToken.address, MINT_ABI, signer);
            const mintAmount = ethers.parseUnits('1000', selectedToken.decimals);
            
            console.log('Minting test tokens...');
            const mintTx = await tokenContract.mint(address, mintAmount);
            await mintTx.wait();
            
            alert(`Minted 1000 test ${selectedToken.symbol} tokens!`);
            fetchBalance();
        } catch (error: any) {
            console.error('Mint failed:', error);
            alert('Failed to mint test tokens. This might not be available on this network.');
        }
    }

    useEffect(() => {
        if (address) {
            fetchBalance();
        }
    }, [address, selectedToken]);

    async function fetchBalance() {
        if (!address) return;
        try {
            if (!window.ethereum) return;
            
            const provider = new ethers.BrowserProvider(window.ethereum);
            const tokenContract = new Contract(selectedToken.address, ERC20_ABI, provider);
            
            const balance = await tokenContract.balanceOf(address);
            const formattedBalance = ethers.formatUnits(balance, selectedToken.decimals);
            setTokenBalance(parseFloat(formattedBalance).toFixed(2));
        } catch (error) {
            console.error('Failed to fetch balance:', error);
            setTokenBalance('0.00');
        }
    }

    async function handleDeposit() {
        if (!address || !depositAmount || parseFloat(depositAmount) <= 0) return;
        setIsProcessing(true);
        try {
            // Get provider and signer
            if (!window.ethereum) {
                throw new Error('Please install MetaMask');
            }

            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            
            console.log('Using token:', selectedToken.address);
            console.log('Using market contract:', MARKET_CONTRACT);
            console.log('Deposit amount:', depositAmount, selectedToken.symbol);
            
            // Create contract instances with signer
            const tokenContract = new Contract(selectedToken.address, ERC20_ABI, signer);
            const marketContract = new Contract(MARKET_CONTRACT, MARKET_ABI, signer);
            
            const amountInWei = ethers.parseUnits(depositAmount, selectedToken.decimals);
            console.log('Amount in wei:', amountInWei.toString());
            
            // Check token balance first
            const tokenBalance = await tokenContract.balanceOf(address);
            console.log('Token balance:', ethers.formatUnits(tokenBalance, selectedToken.decimals));
            
            if (tokenBalance < amountInWei) {
                throw new Error(`Insufficient ${selectedToken.symbol} balance. You have ${ethers.formatUnits(tokenBalance, selectedToken.decimals)} ${selectedToken.symbol}`);
            }
            
            // Step 1: Check current allowance
            const currentAllowance = await tokenContract.allowance(address, MARKET_CONTRACT);
            console.log('Current allowance:', ethers.formatUnits(currentAllowance, selectedToken.decimals));
            
            if (currentAllowance < amountInWei) {
                console.log('Approving token spend...');
                try {
                    const approveTx = await tokenContract.approve(MARKET_CONTRACT, amountInWei);
                    console.log('Approval transaction sent:', approveTx.hash);
                    await approveTx.wait();
                    console.log('Approval confirmed');
                } catch (approveError: any) {
                    console.error('Approval failed:', approveError);
                    throw new Error(`Token approval failed: ${approveError.message || 'Unknown error'}`);
                }
            }
            
            // Step 2: Deposit to market contract
            console.log('Depositing to market...');
            try {
                const depositTx = await marketContract.deposit(amountInWei);
                console.log('Deposit transaction sent:', depositTx.hash);
                await depositTx.wait();
                console.log('Deposit confirmed');
            } catch (depositError: any) {
                console.error('Deposit failed:', depositError);
                throw new Error(`Deposit failed: ${depositError.message || 'Unknown error'}`);
            }
            
            console.log('Deposit successful!');
            alert(`Successfully deposited ${depositAmount} ${selectedToken.symbol}!`);
            setDepositAmount('');
            fetchBalance();
            
        } catch (error: any) {
            console.error('Deposit failed:', error);
            let errorMessage = 'Deposit failed';
            
            if (error.code === 'ACTION_REJECTED') {
                errorMessage = 'Transaction was rejected by user';
            } else if (error.message?.includes('insufficient funds')) {
                errorMessage = 'Insufficient funds for transaction';
            } else if (error.message?.includes('Insufficient')) {
                errorMessage = error.message;
            } else if (error.message?.includes('approval')) {
                errorMessage = error.message;
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            alert(errorMessage);
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
                                <p className="text-sm text-white/50">{address?.slice(0, 8)}...{address?.slice(-6)}</p>
                            </div>
                        </div>
                        <button onClick={() => disconnect()} className="text-xs text-white/40 hover:text-white/70 transition-colors">
                            Disconnect
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-black/40 border border-white/10 rounded-xl p-4">
                            <label className="text-sm font-medium text-white/60 mb-3 block">Select Token</label>
                            <div className="mb-4">
                                <div className="py-3 px-4 rounded-lg font-bold bg-primary text-black border-2 border-primary shadow-[0_0_15px_rgba(0,240,255,0.3)]">
                                    <div className="flex items-center justify-center gap-2">
                                        <span>USDC</span>
                                        <CheckCircle className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                            <div className="text-xs text-white/40 text-center">
                                Selected: <span className="text-primary font-bold">USDC</span> (Direct Deposit)
                            </div>
                            <div className="text-xs text-white/30 text-center mt-2">
                                Other tokens coming soon via Zap integration
                            </div>
                        </div>

                        <div className="bg-black/40 border border-white/10 rounded-xl p-4">
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-medium text-white/60">Amount ({selectedToken.symbol})</label>
                                <div className="flex gap-2">
                                    <button onClick={() => setDepositAmount(tokenBalance)} className="text-xs text-secondary hover:text-white cursor-pointer transition-colors">
                                        Balance: {tokenBalance}
                                    </button>
                                    {parseFloat(tokenBalance) === 0 && (
                                        <button onClick={mintTestTokens} className="text-xs text-primary hover:text-primary/80 cursor-pointer transition-colors">
                                            Get Test Tokens
                                        </button>
                                    )}
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
                            {isProcessing ? 'Processing...' : 'Approve & Deposit'}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-surface/50 backdrop-blur-md border border-white/10 rounded-2xl p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
                        <Wallet className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Connect Wallet</h2>
                    <p className="text-white/50 mb-6">Connect your wallet to deposit funds</p>
                    <button onClick={() => connect()} className="px-6 py-3 bg-primary hover:bg-primary/80 text-black font-bold rounded-xl transition-all">
                        Connect Wallet
                    </button>
                </div>
            )}
        </div>
    );
}
