'use client';

import { useEIP6963 } from '@/lib/useEIP6963';
import { useWallet } from '@/lib/use-wallet';
import { LogOut, Wallet, Shield } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { WalletSelectorModal } from './WalletSelectorModal';

export function WalletConnectButton({ minimal = false }: { minimal?: boolean }) {
    const { isAdmin, chain } = useWallet();
    const {
        wallets,
        walletState,
        isConnecting,
        error,
        connect,
        connectMetaMaskSDK,
        disconnect,
        isMobile,
    } = useEIP6963();

    const [mounted, setMounted] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const copyAddress = () => {
        if (walletState.address) {
            navigator.clipboard.writeText(walletState.address);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Prevent hydration mismatch by not rendering wallet state until mounted
    if (!mounted) {
        return (
            <button
                className={`flex items-center gap-2 px-4 py-2 bg-primary/20 border border-primary/50 rounded-lg text-primary font-medium transition-all duration-200 ${minimal ? 'w-full justify-center px-0' : ''}`}
            >
                <Wallet size={18} />
                {!minimal && <span>Connect Wallet</span>}
            </button>
        );
    }

    if (!walletState.isConnected) {
        return (
            <>
                <button
                    onClick={() => setShowModal(true)}
                    className={`flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/50 rounded-lg text-primary font-medium transition-all duration-200 ${minimal ? 'w-full justify-center px-0' : ''}`}
                >
                    <Wallet size={18} />
                    {!minimal && <span>Connect Wallet</span>}
                </button>

                <WalletSelectorModal
                    isOpen={showModal}
                    onClose={() => setShowModal(false)}
                    wallets={wallets}
                    onSelectWallet={async (wallet) => {
                        await connect(wallet);
                        setShowModal(false);
                    }}
                    onConnectMetaMaskSDK={async () => {
                        await connectMetaMaskSDK();
                        setShowModal(false);
                    }}
                    isConnecting={isConnecting}
                    error={error}
                    isMobile={isMobile}
                />
            </>
        );
    }

    if (minimal) {
        return (
            <div className="w-full flex items-center gap-2">
                <button
                    onClick={copyAddress}
                    className="flex-1 flex items-center justify-center p-2 bg-white/5 hover:bg-white/10 hover:border-white/20 border border-transparent rounded-lg transition-all"
                    title={copied ? 'Copied!' : walletState.address || ''}
                >
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse mr-2" />
                    <span className="font-mono text-xs text-white">
                        {copied ? 'Copied!' : `${walletState.address?.slice(0, 4)}...${walletState.address?.slice(-4)}`}
                    </span>
                </button>
                <button
                    onClick={disconnect}
                    className="p-2 text-white/40 hover:text-red-400 transition-colors"
                    title="Disconnect"
                >
                    <LogOut size={16} />
                </button>
            </div>
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
                onClick={copyAddress}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all duration-200"
                title={copied ? 'Copied!' : 'Click to copy address'}
            >
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <div className="flex flex-col items-start">
                    <span className="text-xs text-white/60">
                        {walletState.walletName || chain?.name || 'Connected'}
                    </span>
                    <span className="text-sm font-mono text-white">
                        {copied ? 'Copied!' : `${walletState.address?.slice(0, 6)}...${walletState.address?.slice(-4)}`}
                    </span>
                </div>
            </button>

            {/* Disconnect */}
            <button
                onClick={disconnect}
                className="p-2 text-white/40 hover:text-red-400 transition-colors"
                title="Disconnect"
            >
                <LogOut size={18} />
            </button>
        </div>
    );
}
