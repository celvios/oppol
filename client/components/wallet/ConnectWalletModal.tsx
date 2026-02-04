"use client";

import { useEffect, useState } from "react";
import { Wallet, X, Mail, ArrowLeft, Loader2 } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import NeonButton from "@/components/ui/NeonButton";
import { usePrivy } from "@privy-io/react-auth";
import UsernameOnboardingModal from "./UsernameOnboardingModal";

interface ConnectWalletModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConnect: () => Promise<void> | void;
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
    // Use ONLY Privy - handles all wallet types
    const { login, ready, authenticated } = usePrivy();

    const [loading, setLoading] = useState(false);
    const [showIdentityModal, setShowIdentityModal] = useState(false);
    const [conflictDetails, setConflictDetails] = useState<{ suggested: string, wallet: string } | null>(null);

    // Auto-close if authenticated
    useEffect(() => {
        if (authenticated && isOpen) {
            onClose();
        }
    }, [authenticated, isOpen, onClose]);

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

    // Simple connect - Privy handles everything
    const handleConnect = async () => {
        try {
            setLoading(true);
            // Close our modal immediately so Privy's modal can show
            onClose();
            // Trigger Privy login - Privy's modal will appear
            await login();
        } catch (error) {
            console.error('[ConnectWalletModal] Connection error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleBackendRegistration = async (address: string) => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const res = await fetch(`${apiUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address }),
            });

            if (!res.ok) {
                const data = await res.json();
                if (data.conflict) {
                    setConflictDetails({
                        suggested: data.suggestedUsername,
                        wallet: address
                    });
                    setShowIdentityModal(true);
                    return false;
                }
            }
            return true;
        } catch (e) {
            console.error("[Auth] Registration error:", e);
            return false;
        }
    };

    const onIdentitySubmit = async (newUsername: string) => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            await fetch(`${apiUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: conflictDetails?.wallet,
                    username: newUsername
                }),
            });

            setShowIdentityModal(false);
            setConflictDetails(null);
            onClose();
        } catch (error) {
            console.error('[Auth] Identity submission error:', error);
        }
    };

    const getContextMessage = () => {
        switch (context) {
            case 'bet':
                return `Betting on ${contextData?.marketName || 'this market'}`;
            case 'deposit':
                return `Deposit ${contextData?.amount || 'funds'}`;
            case 'withdraw':
                return `Withdraw ${contextData?.amount || 'funds'}`;
            case 'portfolio':
                return 'View your portfolio';
            case 'create':
                return 'Create a new market';
            default:
                return 'Continue';
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <GlassCard className="w-full max-w-md relative animate-slideUp">
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors z-10"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center">
                            <Wallet className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-2">
                            Connect Wallet
                        </h2>
                        <p className="text-white/60 text-sm">
                            {getContextMessage()}
                        </p>
                    </div>

                    {/* Content */}
                    <div className="space-y-4">
                        {/* Single Connect Button - Privy handles everything */}
                        <NeonButton
                            variant="cyan"
                            onClick={handleConnect}
                            disabled={loading || !ready}
                            className="w-full flex items-center justify-center gap-2 py-4 font-bold disabled:opacity-70 disabled:cursor-wait"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wallet className="w-5 h-5" />}
                            {loading ? 'Connecting...' : !ready ? 'Initializing...' : 'Connect Wallet'}
                        </NeonButton>

                        {/* Info text */}
                        <p className="text-white/40 text-xs text-center">
                            Supports MetaMask, WalletConnect, Email, and more
                        </p>
                    </div>
                </GlassCard>
            </div>

            {/* Username modal */}
            {showIdentityModal && conflictDetails && (
                <UsernameOnboardingModal
                    isOpen={showIdentityModal}
                    onClose={() => setShowIdentityModal(false)}
                    suggestedUsername={conflictDetails.suggested}
                    onSubmit={onIdentitySubmit}
                />
            )}
        </>
    );
}
