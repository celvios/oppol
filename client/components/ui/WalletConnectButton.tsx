'use client';

import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useWallet } from '@/lib/use-wallet';
import { LogOut, Wallet, Shield } from 'lucide-react';
import { useDisconnect } from 'wagmi';
import Link from 'next/link';

export function WalletConnectButton() {
    const { open } = useWeb3Modal();
    const { address, isConnected, usdcBalance, isAdmin, chain } = useWallet();
    const { disconnect } = useDisconnect();

    if (!isConnected) {
        return (
            <button
                onClick={() => open()}
                className="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/50 rounded-lg text-primary font-medium transition-all duration-200"
            >
                <Wallet size={18} />
                Connect Wallet
            </button>
        );
    }

    return (
        <div className="flex items-center gap-3">
            {/* Admin Badge */}
            {isAdmin && (
                <Link
                    href="/admin"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 border border-amber-500/50 rounded-lg text-amber-400 text-sm font-medium hover:bg-amber-500/30 transition-all"
                >
                    <Shield size={14} />
                    Admin
                </Link>
            )}

            {/* Wallet Info */}
            <button
                onClick={() => open({ view: 'Account' })}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all duration-200"
            >
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <div className="flex flex-col items-start">
                    <span className="text-xs text-white/60">{chain?.name || 'Unknown'}</span>
                    <span className="text-sm font-mono text-white">
                        {address?.slice(0, 6)}...{address?.slice(-4)}
                    </span>
                </div>
                <span className="text-xs text-success font-medium ml-1">
                    ${usdcBalance} USDC
                </span>
            </button>

            {/* Disconnect */}
            <button
                onClick={() => disconnect()}
                className="p-2 text-white/40 hover:text-red-400 transition-colors"
                title="Disconnect"
            >
                <LogOut size={18} />
            </button>
        </div>
    );
}
