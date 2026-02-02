"use client";

import { useEffect } from "react";
import { Wallet, X } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import NeonButton from "@/components/ui/NeonButton";
import { usePrivy } from "@privy-io/react-auth";

interface ConnectWalletModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConnect: () => void;
    context: 'bet' | 'deposit' | 'withdraw' | 'portfolio' | 'general' | 'create';
    contextData?: {
        marketName?: string;
        amount?: string;
    };
}

export default function ConnectWalletModal({
    isOpen,
    onClose,
    onConnect,
    context,
    contextData
}: ConnectWalletModalProps) {
    const { login: privyLogin, ready, authenticated } = usePrivy();

    // Debug logging
    useEffect(() => {
        console.log('[ConnectWalletModal] Privy State:', { ready, authenticated, hasLogin: !!privyLogin });
    }, [ready, authenticated, privyLogin]);

    // Handle ESC key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const getContextMessage = () => {
        switch (context) {
            case 'bet':
                return contextData?.marketName
                    ? `To place a bet on "${contextData.marketName}", connect your wallet.`
                    : 'Connect your wallet to place bets on prediction markets.';
            case 'deposit':
                return 'Connect your wallet to deposit funds and start trading.';
            case 'withdraw':
                return 'Connect your wallet to withdraw your funds.';
            case 'portfolio':
                return 'Connect your wallet to view your positions and trading history.';
            case 'create':
                return 'Connect your wallet to create a new poll.';
            default:
                return 'Connect your wallet to access all features.';
        }
    };

    const handleConnect = () => {
        onConnect();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md animate-scaleIn">
                <GlassCard className="p-8 text-center relative">
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition-colors"
                        aria-label="Close modal"
                    >
                        <X size={20} />
                    </button>

                    {/* Icon */}
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 flex items-center justify-center">
                        <Wallet className="w-10 h-10 text-neon-cyan" />
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-bold text-white mb-3">
                        Log In
                    </h2>

                    {/* Context Message */}
                    <p className="text-white/60 mb-8 leading-relaxed">
                        {getContextMessage()}
                    </p>

                    {/* Login Buttons */}
                    <NeonButton
                        variant="cyan"
                        onClick={handleConnect}
                        className="w-full mb-3 flex items-center justify-center gap-2 py-4 font-bold"
                    >
                        <Wallet className="w-5 h-5" />
                        Connect External Wallet
                    </NeonButton>

                    <div className="relative mb-3">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-[#0A0A12] px-2 text-white/30">Or</span>
                        </div>
                    </div>

                    <NeonButton
                        variant="purple"
                        onClick={() => {
                            console.log('[ConnectWalletModal] Privy Login Clicked');
                            if (!ready) {
                                console.error('[ConnectWalletModal] Privy NOT READY');
                                return;
                            }
                            try {
                                privyLogin({ onComplete: onClose });
                            } catch (e) {
                                console.error('[ConnectWalletModal] Login Failed:', e);
                            }
                        }}
                        disabled={!ready}
                        className="w-full mb-3 flex items-center justify-center gap-2 py-3 text-sm bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 disabled:cursor-wait"
                    >
                        {!ready ? 'Initializing Login...' : 'Log In with Email / Socials'}
                    </NeonButton>

                    <p className="text-white/30 text-xs mt-4">
                        Powered by WalletConnect & Privy
                    </p>

                    {/* Dismiss */}
                    <button
                        onClick={onClose}
                        className="text-white/40 hover:text-white/60 text-sm transition-colors"
                    >
                        Maybe later
                    </button>
                </GlassCard>
            </div>
        </div>
    );
}
