'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { motion, AnimatePresence } from 'framer-motion';
import NeonButton from '@/components/ui/NeonButton';
import { ArrowRight, Loader2, RefreshCw } from 'lucide-react';

// USDC Contract ABI (Minimal)
const USDC_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)"
];

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed.binance.org/';

export default function FundMigrationManager() {
    const { user, loginMethod } = useAuth(); // Privacy/Backend User info
    const { wallets } = useWallets(); // Get all connected wallets from Privy

    // Debugging: Log all wallets
    useEffect(() => {
        if (wallets.length > 0) {
            console.log('[Migration] Wallets State:', wallets.map(w => ({ type: w.walletClientType, address: w.address })));
        }
    }, [wallets]);

    // The "Legacy" wallet is the connected embedded wallet
    // IMPROVED LOGIC: Match by type OR if it matches user.wallet.address (which comes from Privy auth)
    // We now filter ALL potential wallets and check which one has funds
    const potentialWallets = wallets.filter(w =>
        w.walletClientType === 'privy' ||
        (user?.wallet?.address && w.address.toLowerCase() === user.wallet.address.toLowerCase())
    );

    const [activeLegacyWallet, setActiveLegacyWallet] = useState<any>(null);
    const legacyAddress = activeLegacyWallet?.address;

    const [needsMigration, setNeedsMigration] = useState(false);
    const [balance, setBalance] = useState('0');
    const [custodialAddress, setCustodialAddress] = useState<string | null>(null);
    const [isMigrating, setIsMigrating] = useState(false);
    const [txHash, setTxHash] = useState('');
    const [error, setError] = useState('');
    const [isCompleted, setIsCompleted] = useState(false);

    // Ref to prevent double checking
    const hasChecked = useRef(false);

    useEffect(() => {
        const checkMigrationStatus = async () => {
            console.log('[Migration] Checking status...', {
                userId: user?.id,
                userWalletAddress: user?.wallet?.address,
                legacyAddress,
                loginMethod,
                hasChecked: hasChecked.current,
                walletsLength: wallets.length
            });

            if (!user) {
                console.log('[Migration] Missing user. Skipping.');
                return;
            }
            if (hasChecked.current) {
                console.log('[Migration] Already checked. Skipping.');
                return;
            }

            try {
                // Fetch user by Privy ID + Wallet Address tuple to find the backend record
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
                console.log(`[Migration] Fetching user from ${apiUrl}/api/auth/privy...`);

                // Determine login method more robustly
                let effectiveLoginMethod = loginMethod as any;

                if ((!effectiveLoginMethod || effectiveLoginMethod === 'privy') && user.linkedAccounts) {
                    const google = user.linkedAccounts.find((a: any) => a.type === 'google_oauth');
                    const twitter = user.linkedAccounts.find((a: any) => a.type === 'twitter_oauth');
                    const discord = user.linkedAccounts.find((a: any) => a.type === 'discord_oauth');
                    const email = user.linkedAccounts.find((a: any) => a.type === 'email');

                    if (google) effectiveLoginMethod = 'google';
                    else if (twitter) effectiveLoginMethod = 'twitter';
                    else if (discord) effectiveLoginMethod = 'discord';
                    else if (email) effectiveLoginMethod = 'email';
                }

                console.log(`[Migration] Effective Login Method: ${effectiveLoginMethod}`);

                const syncRes = await fetch(`${apiUrl}/api/auth/privy`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        privyUserId: user.id,
                        walletAddress: legacyAddress,
                        loginMethod: effectiveLoginMethod || 'privy'
                    })
                });

                const syncData = await syncRes.json();
                console.log('[Migration] API Response:', syncData);

                if (!syncData.success || !syncData.user) {
                    console.log('[Migration] API failed or no user returned.');
                    return;
                }

                const dbUser = syncData.user;
                console.log(`[Migration] DB User Wallet: ${dbUser.wallet_address}`);

                // Compare Addresses: If DB has a different address, check if ANY potential wallet needs migration

                // Iterate through all potential wallets to find one with funds
                let foundWalletWithFunds = false;

                // Use our own RPC for reliable read-only calls
                const provider = new ethers.JsonRpcProvider(RPC_URL);
                const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

                for (const wallet of potentialWallets) {
                    if (dbUser.wallet_address && wallet.address.toLowerCase() === dbUser.wallet_address.toLowerCase()) {
                        console.log(`[Migration] Wallet ${wallet.address} matches DB custodial address. Skipping.`);
                        continue;
                    }

                    console.log(`[Migration] Checking balance for potential wallet: ${wallet.address}`);

                    try {
                        const balanceWei = await usdcContract.balanceOf(wallet.address);
                        const balanceFormatted = ethers.formatUnits(balanceWei, 18);
                        console.log(`💰 [Migration] Balance for ${wallet.address}: ${balanceFormatted}`);

                        if (parseFloat(balanceFormatted) > 0.01) {
                            console.log(`[Migration] Found wallet with funds! ${wallet.address}`);
                            setActiveLegacyWallet(wallet);
                            setBalance(balanceFormatted);
                            setCustodialAddress(dbUser.wallet_address);
                            setNeedsMigration(true);
                            foundWalletWithFunds = true;
                            break; // Stop after finding the first valid wallet
                        }
                    } catch (e) {
                        console.error(`[Migration] Error checking balance for ${wallet.address}:`, e);
                    }
                }

                if (!foundWalletWithFunds) {
                    console.log('[Migration] No eligible wallets with funds found.');
                }

                hasChecked.current = true;

            } catch (err) {
                console.error('❌ [Migration] Check failed:', err);
            }
        };

        // Only run check if we have potential wallets and haven't checked yet
        if (potentialWallets.length > 0 && !hasChecked.current) {
            checkMigrationStatus();
        }
    }, [user, potentialWallets.length, loginMethod]);

    const { sendTransaction, exportWallet } = usePrivy(); // For signing and exporting

    // ... (rest of imports/hooks)

    // State for fallback
    const [showExport, setShowExport] = useState(false);

    // ... (checkMigrationStatus logic stays same) ...

    const handleMigrate = async () => {
        if (!custodialAddress || !legacyAddress || !user) return;
        setIsMigrating(true);
        setStatus('starting');
        setError('');
        setShowExport(false);

        try {
            console.log(`[Migration] Attempting client-side migration: ${legacyAddress} -> ${custodialAddress}`);

            const provider = new ethers.JsonRpcProvider(RPC_URL);

            // Fix API URL for production
            const apiUrl = process.env.NEXT_PUBLIC_API_URL ||
                (typeof window !== 'undefined' && window.location.origin.includes('localhost')
                    ? 'http://localhost:3001'
                    : 'https://oppol-api.onrender.com'); // Updated fallback

            // 1. Check for BNB Gas
            let bnbBalance = await provider.getBalance(legacyAddress);
            const minGas = ethers.parseEther("0.001");

            if (bnbBalance < minGas) {
                console.log('[Migration] Low Gas. Requesting from faucet...');
                setStatus('faucet');
                try {
                    const res = await fetch(`${apiUrl}/api/faucet/claim`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ address: legacyAddress })
                    });
                    const faucetData = await res.json();

                    if (faucetData.success) {
                        console.log('[Migration] Gas requested. Polling for arrival...');
                        setStatus('waiting-for-gas');

                        // Poll for up to 20s for BNB balance to increase
                        let attempts = 0;
                        while (attempts < 10) {
                            await new Promise(r => setTimeout(r, 2000));
                            const newBal = await provider.getBalance(legacyAddress);
                            if (newBal > bnbBalance) {
                                console.log('[Migration] Gas confirmed!');
                                bnbBalance = newBal;
                                break;
                            }
                            attempts++;
                        }
                    } else {
                        throw new Error(faucetData.error || 'Faucet failed to send gas');
                    }
                } catch (faucetErr: any) {
                    console.error('[Migration] Faucet failed:', faucetErr);
                    // Continue anyway, maybe they have enough
                }
            }

            setStatus('preparing-tx');
            // 2. Prepare transaction
            const amountWei = ethers.parseUnits(balance, 18);
            const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
            const transferData = usdcContract.interface.encodeFunctionData("transfer", [custodialAddress, amountWei]);

            setStatus('signing');
            // 3. Send transaction via Privy Embedded Wallet
            // We use the simpler signature: sendTransaction({ to, data, value })
            // Privy handles gas and chain switching if needed.
            const txReceipt = await sendTransaction({
                to: USDC_ADDRESS,
                data: transferData,
                value: '0x0', // Must be hex string for Privy
                chainId: 56 // BSC
            });

            console.log('✅ [Migration] Client-side transfer complete!', txReceipt);
            setTxHash(txReceipt.transactionHash);
            setIsCompleted(true);

            setTimeout(() => {
                setNeedsMigration(false);
            }, 5000);

        } catch (err: any) {
            console.error('❌ [Migration] Failed:', err);
            // Check for specific "Recovery method not supported" or similar errors
            const errorMessage = err.message || JSON.stringify(err);

            setError('Migration failed. Your wallet may require manual export.');

            // ALWAYS show export option on failure, as server-side is also dead.
            setShowExport(true);

            if (errorMessage.includes('Recovery method not supported') ||
                errorMessage.includes('user-passcode') ||
                errorMessage.includes('google-drive')) {
                setError('Automated migration not supported for this wallet type.');
            }
        } finally {
            setIsMigrating(false);
            setStatus('idle');
        }
    };

    const [status, setStatus] = useState<'idle' | 'starting' | 'faucet' | 'waiting-for-gas' | 'preparing-tx' | 'signing'>('idle');

    const getStatusMessage = () => {
        switch (status) {
            case 'starting': return 'Starting migration...';
            case 'faucet': return 'Requesting gas from faucet...';
            case 'waiting-for-gas': return 'Waiting for gas to arrive (2-5s)...';
            case 'preparing-tx': return 'Preparing transfer...';
            case 'signing': return 'Please sign in the popup';
            default: return 'Moving Funds...';
        }
    };

    const handleExport = async () => {
        try {
            await exportWallet();
        } catch (err) {
            console.error('Failed to export wallet', err);
            setError('Failed to open export window. Check popups.');
        }
    };

    if (!needsMigration && !isCompleted) return null;

    return (
        <AnimatePresence>
            {needsMigration && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                >
                    <div className="bg-zinc-900 border border-neon-cyan/50 p-8 rounded-2xl max-w-md w-full shadow-[0_0_50px_rgba(6,182,212,0.2)] text-center">
                        <div className="flex justify-center mb-6">
                            <div className="bg-neon-cyan/20 p-4 rounded-full relative">
                                <RefreshCw className={`w-12 h-12 text-neon-cyan ${isMigrating ? 'animate-spin' : ''}`} />
                            </div>
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-2">Upgrade Your Wallet</h2>

                        {!isCompleted ? (
                            <>
                                <p className="text-gray-400 mb-6">
                                    We've upgraded our system for <b>Instant Betting</b>! <br />
                                    We found <b>{parseFloat(balance).toFixed(2)} USDC</b> in your old wallet.
                                    <br /><br />
                                    Please migrate them to your new secure wallet to continue playing.
                                </p>

                                {error && (
                                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm">
                                        <p className="font-bold mb-1">Migration Failed</p>
                                        {error}
                                    </div>
                                )}

                                {!showExport ? (
                                    <>
                                        <NeonButton
                                            onClick={handleMigrate}
                                            disabled={isMigrating}
                                            variant="cyan"
                                            className="w-full py-4 text-lg"
                                        >
                                            {isMigrating ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <Loader2 className="animate-spin" /> {getStatusMessage()}
                                                </span>
                                            ) : (
                                                <span className="flex items-center justify-center gap-2">
                                                    Migrate Funds <ArrowRight size={18} />
                                                </span>
                                            )}
                                        </NeonButton>

                                        <button
                                            onClick={() => setShowExport(true)}
                                            className="text-xs text-gray-500 hover:text-white underline mt-4 block mx-auto"
                                        >
                                            Having trouble? Export Private Key Manually
                                        </button>
                                    </>
                                ) : (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
                                        <p className="text-sm text-yellow-500 bg-yellow-500/10 p-2 rounded">
                                            Your wallet requires manual export due to security settings.
                                        </p>
                                        <NeonButton
                                            onClick={handleExport}
                                            variant="glass"
                                            className="w-full py-3"
                                        >
                                            Export Private Key
                                        </NeonButton>
                                        <p className="text-xs text-gray-500">
                                            Export key, import to MetaMask/Rabby, and send funds to: <br />
                                            <span className="font-mono select-all bg-black/50 p-1 rounded">{custodialAddress}</span>
                                        </p>

                                        <button
                                            onClick={handleMigrate}
                                            className="text-xs text-gray-500 hover:text-white underline mt-2"
                                        >
                                            Try Auto-Migration Again
                                        </button>
                                    </div>
                                )}

                                {!showExport && (
                                    <p className="text-xs text-gray-500 mt-4">
                                        Requires a small amount of BNB for gas.
                                    </p>
                                )}
                            </>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-green-400 font-bold text-lg">Migration Successful! 🎉</p>
                                <p className="text-gray-400">
                                    Your funds have been moved to your new wallet. You can now bet instantly!
                                </p>
                                <NeonButton
                                    onClick={() => setNeedsMigration(false)}
                                    variant="glass"
                                    className="w-full"
                                >
                                    Close & Play
                                </NeonButton>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
