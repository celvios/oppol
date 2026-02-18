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
    const { sendTransaction } = usePrivy(); // For signing from embedded wallet

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

            if (!user || !legacyAddress) {
                console.log('[Migration] Missing user or legacy address. Skipping.');
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

    const handleMigrate = async () => {
        if (!custodialAddress || !legacyAddress || !user) return;
        setIsMigrating(true);
        setError('');

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

            console.log(`[Migration] Calling server-side migration: ${legacyAddress} -> ${custodialAddress}`);

            // Call the backend to handle migration via Privy REST API (server-side signing)
            const res = await fetch(`${apiUrl}/api/migrate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    privyUserId: user.id,
                    legacyAddress,
                    custodialAddress
                })
            });

            const data = await res.json();

            if (!data.success) {
                throw new Error(data.error || 'Migration failed on server');
            }

            console.log('✅ [Migration] Server-side transfer complete!', data);

            setTxHash(data.txHash || 'confirmed');
            setIsCompleted(true);

            // Hide modal after delay
            setTimeout(() => {
                setNeedsMigration(false);
            }, 5000);

        } catch (err: any) {
            console.error('❌ [Migration] Failed:', err);
            setError(err.message || 'Migration failed. Please try again.');
        } finally {
            setIsMigrating(false);
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
                                        {error}
                                    </div>
                                )}

                                <NeonButton
                                    onClick={handleMigrate}
                                    disabled={isMigrating}
                                    variant="cyan"
                                    className="w-full py-4 text-lg"
                                >
                                    {isMigrating ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <Loader2 className="animate-spin" /> Moving Funds...
                                        </span>
                                    ) : (
                                        <span className="flex items-center justify-center gap-2">
                                            Migrate Funds <ArrowRight size={18} />
                                        </span>
                                    )}
                                </NeonButton>

                                <p className="text-xs text-gray-500 mt-4">
                                    Requires a small amount of BNB for gas.
                                </p>
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
