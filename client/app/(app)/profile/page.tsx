"use client";

import { Bell, Shield, Wallet, Monitor, CheckCircle, Calendar, Activity, Copy, User } from "lucide-react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useWallet } from "@/lib/use-wallet";
import { useState } from "react";
import { motion } from "framer-motion";

export default function ProfilePage() {
    const { user, authenticated } = usePrivy();
    const { address, disconnect } = useWallet();
    const { wallets } = useWallets();

    const [copied, setCopied] = useState(false);

    // Identify Embedded (Google/Social) Wallet
    const isEmbeddedWallet = authenticated && (!!user?.google || !!user?.email || !!user?.twitter || !!user?.discord);

    // Use effective address
    const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
    const effectiveAddress = address || user?.wallet?.address || embeddedWallet?.address || "";

    const displayName = user?.google?.name || user?.email?.address?.split('@')[0] || (effectiveAddress ? `${effectiveAddress.slice(0, 6)}...${effectiveAddress.slice(-4)}` : "Guest User");
    const displayEmail = user?.google?.email || user?.email?.address || "";

    // Date Joined (from Privy or Mock)
    const dateJoined = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : "January 2025";

    const copyToClipboard = () => {
        if (effectiveAddress) {
            navigator.clipboard.writeText(effectiveAddress);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8 pb-20">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-mono font-bold text-white">PROFILE</h1>
                {authenticated && (
                    <button onClick={() => disconnect()} className="text-white/40 hover:text-white text-sm transition-colors">
                        Sign Out
                    </button>
                )}
            </div>

            {/* Profile Header */}
            <div className="relative bg-surface/30 border border-white/5 rounded-2xl overflow-hidden">
                {/* Banner / Background */}
                <div className="h-32 bg-gradient-to-r from-primary/20 to-purple-500/20 w-full absolute top-0 left-0" />

                <div className="pt-16 px-6 pb-6 relative z-10">
                    <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
                        {/* Avatar */}
                        <div className="w-24 h-24 rounded-full bg-black border-4 border-black shadow-xl flex items-center justify-center relative">
                            {user?.google?.picture ? (
                                <img src={user.google.picture} alt="Profile" className="w-full h-full rounded-full object-cover" />
                            ) : (
                                <div className="w-full h-full rounded-full bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center text-3xl font-bold text-white uppercase">
                                    {displayName.charAt(0)}
                                </div>
                            )}
                            {authenticated && (
                                <div className="absolute bottom-0 right-0 bg-black rounded-full p-1">
                                    <CheckCircle className="w-6 h-6 text-neon-cyan fill-black" />
                                </div>
                            )}
                        </div>

                        {/* Info */}
                        <div className="text-center md:text-left flex-1">
                            <h2 className="text-2xl font-bold text-white flex items-center justify-center md:justify-start gap-2">
                                {displayName}
                                {authenticated && <span className="text-xs bg-neon-cyan/10 text-neon-cyan px-2 py-0.5 rounded border border-neon-cyan/20">VERIFIED</span>}
                            </h2>
                            <p className="text-white/40 font-mono text-sm mb-1">{displayEmail}</p>
                            <p className="text-white/30 text-xs flex items-center justify-center md:justify-start gap-1">
                                <Calendar className="w-3 h-3" />
                                Member since {dateJoined}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* GOOGLE USERS: Stats Grid */}
            {isEmbeddedWallet && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Wallet Address */}
                    <div className="bg-surface/30 border border-white/5 rounded-xl p-4 md:col-span-3 lg:col-span-1">
                        <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Wallet Address</p>
                        <div className="flex items-center gap-2 bg-black/20 p-2 rounded-lg border border-white/5 cursor-pointer hover:bg-white/5 transition-colors group" onClick={copyToClipboard}>
                            <code className="text-sm font-mono text-white flex-1 truncate">
                                {effectiveAddress}
                            </code>
                            {copied ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                                <Copy className="w-4 h-4 text-white/30 group-hover:text-white transition-colors" />
                            )}
                        </div>
                    </div>

                    {/* Total Volume */}
                    <div className="bg-surface/30 border border-white/5 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Activity className="w-4 h-4 text-primary" />
                            <p className="text-white/40 text-xs uppercase tracking-widest">Total Volume</p>
                        </div>
                        <p className="text-2xl font-mono text-white">$2,450.00</p>
                        <p className="text-white/20 text-xs">Lifetime traded</p>
                    </div>

                    {/* Accuracy Rate */}
                    <div className="bg-surface/30 border border-white/5 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-purple-400" />
                            <p className="text-white/40 text-xs uppercase tracking-widest">Accuracy Rate</p>
                        </div>
                        <p className="text-2xl font-mono text-green-400">68%</p>
                        <p className="text-white/20 text-xs">Win Rate (Top 15%)</p>
                    </div>
                </div>
            )}



            <div className="pt-8 text-center">
                <p className="text-white/20 text-xs uppercase tracking-widest">
                    OPoll Terminal v1.0.1 (Beta)
                </p>
            </div>
        </div>
    );
}
