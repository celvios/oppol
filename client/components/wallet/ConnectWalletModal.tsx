"use client";

import { useEffect, useState } from "react";
import { Wallet, X, Loader2, Sparkles, Zap, ShieldCheck, Mail, Globe, ArrowRight, ChevronLeft } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import NeonButton from "@/components/ui/NeonButton";
import Input from "@/components/ui/Input";
import { usePrivy, useLoginWithEmail, useLoginWithOAuth } from "@privy-io/react-auth";
import UsernameOnboardingModal from "./UsernameOnboardingModal";
import { motion, AnimatePresence } from "framer-motion";

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

type ViewState = 'selection' | 'email-input' | 'otp-input';

export default function ConnectWalletModal({
    isOpen,
    onClose,
    onConnect,
    context,
    contextData
}: ConnectWalletModalProps) {
    const { login, ready, authenticated } = usePrivy();

    // Headless Hooks
    const { sendCode, loginWithCode } = useLoginWithEmail();
    const { initOAuth } = useLoginWithOAuth();

    const [view, setViewState] = useState<ViewState>('selection');
    const [loadingMethod, setLoadingMethod] = useState<string | null>(null);
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [error, setError] = useState<string | null>(null);

    const [showIdentityModal, setShowIdentityModal] = useState(false);
    const [conflictDetails, setConflictDetails] = useState<{ suggested: string, wallet: string } | null>(null);

    // Reset state on close
    useEffect(() => {
        if (!isOpen) {
            setViewState('selection');
            setEmail("");
            setOtp("");
            setError(null);
            setLoadingMethod(null);
        }
    }, [isOpen]);

    useEffect(() => {
        if (authenticated && isOpen) {
            onClose();
        }
    }, [authenticated, isOpen, onClose]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    // Handlers
    const handleGoogleLogin = async () => {
        try {
            setLoadingMethod('google');
            await initOAuth({ provider: 'google' });
            // Redirect happens automatically
        } catch (err) {
            console.error("Google login failed", err);
            setLoadingMethod(null);
        }
    };

    const handleEmailSubmit = async () => {
        if (!email.includes('@')) {
            setError("Please enter a valid email");
            return;
        }
        setError(null);
        setLoadingMethod('email');
        try {
            await sendCode({ email });
            setViewState('otp-input');
        } catch (err) {
            console.error("Failed to send code", err);
            setError("Failed to send code. Please try again.");
        } finally {
            setLoadingMethod(null);
        }
    };

    const handleOtpSubmit = async () => {
        if (otp.length < 6) return;
        setLoadingMethod('otp');
        setError(null);
        try {
            await loginWithCode({ code: otp, email });
            onClose();
        } catch (err) {
            console.error("Invalid code", err);
            setError("Invalid code. Please try again.");
            setOtp(""); // Clear invalid code for UX
        } finally {
            setLoadingMethod(null);
        }
    };

    const handleWalletLogin = async () => {
        // For standard wallet connection (MetaMask etc), we still use the main login flow
        // but restrict it to 'wallet' only. This usually pops up the wallet extension directly
        // or a very minimal Privy QR for specific wallets.
        onClose();
        await login({ loginMethods: ['wallet'] });
    };

    const getContextInfo = () => {
        switch (context) {
            case 'bet':
                return {
                    title: "Ready to Win?",
                    subtitle: `Place your prediction on ${contextData?.marketName || 'the future'}`,
                    icon: Zap
                };
            case 'deposit':
                return {
                    title: "Fuel Your Account",
                    subtitle: "Add funds to start trading instantly",
                    icon: Wallet
                };
            case 'create':
                return {
                    title: "Become the House",
                    subtitle: "Launch your own prediction market",
                    icon: Sparkles
                };
            default:
                return {
                    title: "Unlock the Future",
                    subtitle: "Connect to access decentralized prediction markets",
                    icon: Wallet
                };
        }
    };

    const content = getContextInfo();
    const Icon = content.icon;

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop with blur and pulse */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/90 backdrop-blur-md"
                    onClick={onClose}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 to-neon-purple/5 animate-pulse" />
                </motion.div>

                {/* Main Card */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative w-full max-w-md"
                >
                    {/* Glowing Border Effect */}
                    <div className="absolute -inset-[1px] bg-gradient-to-r from-neon-cyan via-purple-500 to-neon-cyan rounded-2xl opacity-75 blur-sm animate-gradient-xy" />

                    <GlassCard className="relative w-full overflow-hidden border-none shadow-[0_0_50px_-10px_rgba(0,224,255,0.3)]">
                        {/* Back button (for email flow) */}
                        {view !== 'selection' && (
                            <button
                                onClick={() => setViewState('selection')}
                                className="absolute top-4 left-4 p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all z-20"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                        )}

                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all z-20 group"
                        >
                            <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                        </button>

                        <div className="p-8 text-center relative z-10 min-h-[400px] flex flex-col justify-center">

                            {/* Header Section */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mb-8"
                            >
                                <motion.div
                                    className="w-16 h-16 mx-auto mb-4 relative group"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", stiffness: 200 }}
                                >
                                    <div className="absolute inset-0 bg-neon-cyan/20 rounded-full blur-xl" />
                                    <div className="relative w-full h-full bg-gradient-to-br from-gray-900 to-black rounded-full border border-neon-cyan/50 flex items-center justify-center shadow-[0_0_15px_rgba(0,224,255,0.3)]">
                                        <Icon className="w-6 h-6 text-neon-cyan" />
                                    </div>
                                </motion.div>
                                <h2 className="text-2xl font-bold mb-2 tracking-tight bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">
                                    {content.title}
                                </h2>
                                <p className="text-white/60 text-sm max-w-[80%] mx-auto">
                                    {content.subtitle}
                                </p>
                            </motion.div>

                            {/* VIEW: MAIN SELECTION */}
                            {view === 'selection' && (
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-3"
                                >
                                    <NeonButton
                                        variant="glass"
                                        onClick={() => setViewState('email-input')}
                                        disabled={!ready}
                                        className="w-full py-4 flex items-center justify-start gap-4 px-6 hover:bg-white/5 border border-white/10 hover:border-neon-cyan/50 transition-all group"
                                    >
                                        <div className="p-2 bg-white/5 rounded-full group-hover:bg-neon-cyan/20 transition-colors">
                                            <Mail className="w-5 h-5 text-white group-hover:text-neon-cyan" />
                                        </div>
                                        <span className="font-medium">Continue with Email</span>
                                    </NeonButton>

                                    <NeonButton
                                        variant="glass"
                                        onClick={handleGoogleLogin}
                                        disabled={!ready || !!loadingMethod}
                                        className="w-full py-4 flex items-center justify-start gap-4 px-6 hover:bg-white/5 border border-white/10 hover:border-neon-cyan/50 transition-all group"
                                    >
                                        <div className="p-2 bg-white/5 rounded-full group-hover:bg-neon-cyan/20 transition-colors">
                                            <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" className="w-5 h-5" alt="Google" />
                                        </div>
                                        <span className="font-medium">Continue with Google</span>
                                        {loadingMethod === 'google' && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
                                    </NeonButton>

                                    <NeonButton
                                        variant="cyan"
                                        onClick={handleWalletLogin}
                                        disabled={!ready}
                                        className="w-full py-4 flex items-center justify-start gap-4 px-6 shadow-[0_0_20px_rgba(0,224,255,0.2)] hover:shadow-[0_0_30px_rgba(0,224,255,0.4)] group"
                                    >
                                        <div className="p-2 bg-black/20 rounded-full">
                                            <Wallet className="w-5 h-5 text-black" />
                                        </div>
                                        <span className="font-bold text-black">Connect Wallet</span>
                                    </NeonButton>
                                </motion.div>
                            )}

                            {/* VIEW: EMAIL INPUT */}
                            {view === 'email-input' && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-4"
                                >
                                    <div className="text-left space-y-2">
                                        <label className="text-xs text-neon-cyan font-bold uppercase tracking-wider ml-1">
                                            Email Address
                                        </label>
                                        <Input
                                            type="email"
                                            placeholder="you@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="bg-black/40 border-white/10 focus:border-neon-cyan text-lg py-6"
                                            autoFocus
                                            onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
                                        />
                                        {error && <p className="text-red-400 text-xs ml-1">{error}</p>}
                                    </div>
                                    <NeonButton
                                        variant="cyan"
                                        onClick={handleEmailSubmit}
                                        disabled={loadingMethod === 'email'}
                                        className="w-full py-4 font-bold text-black"
                                    >
                                        {loadingMethod === 'email' ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Send Code"}
                                    </NeonButton>
                                </motion.div>
                            )}

                            {/* VIEW: OTP INPUT */}
                            {view === 'otp-input' && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-4"
                                >
                                    <div className="text-center mb-4">
                                        <p className="text-white/60 text-sm">Code sent to <span className="text-white font-medium">{email}</span></p>
                                    </div>
                                    <div className="text-left space-y-2">
                                        <Input
                                            type="text"
                                            placeholder="123456"
                                            value={otp}
                                            maxLength={6}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/[^0-9]/g, '');
                                                setOtp(val);
                                                if (val.length === 6) handleOtpSubmit();
                                            }}
                                            className="bg-black/40 border-white/10 focus:border-neon-cyan text-2xl py-6 text-center tracking-[0.5em] font-mono"
                                            autoFocus
                                        />
                                        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                                    </div>
                                    <NeonButton
                                        variant="cyan"
                                        onClick={handleOtpSubmit}
                                        disabled={otp.length < 6 || loadingMethod === 'otp'}
                                        className="w-full py-4 font-bold text-black"
                                    >
                                        {loadingMethod === 'otp' ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Verify & Login"}
                                    </NeonButton>
                                    <button
                                        onClick={() => setViewState('email-input')}
                                        className="text-white/40 text-xs hover:text-white transition-colors"
                                    >
                                        Entered wrong email?
                                    </button>
                                </motion.div>
                            )}

                            {/* Footer */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.35 }}
                                className="mt-8 flex flex-col gap-2"
                            >
                                <p className="text-[10px] text-white/30 uppercase tracking-widest font-mono flex items-center justify-center gap-2">
                                    <span>Powered by</span>
                                    <span className="text-neon-cyan font-bold glow-sm">OPoll</span>
                                </p>
                            </motion.div>
                        </div>
                    </GlassCard>
                </motion.div>

                {/* Identity Modal (if needed) */}
                {showIdentityModal && conflictDetails && (
                    <UsernameOnboardingModal
                        isOpen={showIdentityModal}
                        onClose={() => setShowIdentityModal(false)}
                        suggestedUsername={conflictDetails.suggested}
                        onSubmit={(username) => {
                            console.log(username);
                        }}
                    />
                )}
            </div>
        </AnimatePresence>
    );
}
