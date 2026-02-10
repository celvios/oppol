"use client";

import { useEffect, useState } from "react";
import { Wallet, X, Loader2, Sparkles, Zap, Mail, ChevronLeft } from "lucide-react";
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
    context,
    contextData
}: ConnectWalletModalProps) {
    const { ready, authenticated, login } = usePrivy();

    // Headless Hooks (Privy)
    const { sendCode, loginWithCode } = useLoginWithEmail();
    const { initOAuth } = useLoginWithOAuth();

    const [view, setViewState] = useState<ViewState>('selection');
    const [loadingMethod, setLoadingMethod] = useState<string | null>(null);
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [error, setError] = useState<string | null>(null);

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
            await loginWithCode({ code: otp });
            // Closure handled by useEffect on authenticated
        } catch (err) {
            console.error("Invalid code", err);
            setError("Invalid code. Please try again.");
            setOtp("");
        } finally {
            setLoadingMethod(null);
        }
    };

    // Use Privy's native modal for wallet connection
    const handleWalletLogin = () => {
        login({ loginMethods: ['wallet'] });
        // The Privy modal will open on top.
        // We might want to close THIS modal, or keep it open in background?
        // Privy modal usually handles its own overlay.
        // If we keep this open, we need to make sure we detect when Privy connects.
        // The `authenticated` effect handles the closing.
    };

    const getContextInfo = () => {
        switch (context) {
            case 'bet': return { title: "Ready to Win?", subtitle: `Place your prediction on ${contextData?.marketName || 'the future'}`, icon: Zap };
            case 'deposit': return { title: "Connect Your Wallet", subtitle: "Securely connect to deposit funds", icon: Wallet };
            case 'create': return { title: "Create a Market", subtitle: "Connect to launch your prediction market", icon: Sparkles };
            default: return { title: "Connect Your Wallet", subtitle: "Access decentralized prediction markets", icon: Wallet };
        }
    };

    const content = getContextInfo();
    const Icon = content.icon;

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/90 backdrop-blur-md"
                    onClick={onClose}
                >
                </motion.div>

                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative w-full max-w-md"
                >


                    <GlassCard className="relative w-full overflow-hidden border-none shadow-2xl">
                        {view !== 'selection' && (
                            <button
                                onClick={() => setViewState(view === 'otp-input' ? 'email-input' : 'selection')}
                                className="absolute top-4 left-4 p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all z-20"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                        )}

                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all z-20 group"
                        >
                            <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                        </button>

                        <div className="p-8 text-center relative z-10 min-h-[420px] flex flex-col justify-center">

                            {/* Header */}
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                                <motion.div className="w-16 h-16 mx-auto mb-4 relative" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                    <div className="relative w-full h-full bg-black rounded-full border border-white/10 flex items-center justify-center p-3">
                                        <img src="/brand-logo.png" alt="OPoll" className="w-full h-full object-contain" />
                                    </div>
                                </motion.div>
                                <h2 className="text-2xl font-bold mb-2 tracking-tight text-white">
                                    {content.title}
                                </h2>
                                <p className="text-white/60 text-sm max-w-[80%] mx-auto">{content.subtitle}</p>
                            </motion.div>

                            {/* MAIN SELECTION VIEW */}
                            {view === 'selection' && (
                                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
                                    <NeonButton
                                        variant="glass"
                                        onClick={() => setViewState('email-input')}
                                        disabled={!ready}
                                        className="w-full py-4 flex items-center justify-start gap-4 px-6 hover:bg-white/5 border border-white/10 hover:border-white/50 transition-all group"
                                    >
                                        <div className="p-2 bg-white/5 rounded-full group-hover:bg-white/20 transition-colors">
                                            <Mail className="w-5 h-5 text-white" />
                                        </div>
                                        <span className="font-medium">Continue with Email</span>
                                    </NeonButton>

                                    <NeonButton
                                        variant="glass"
                                        onClick={handleGoogleLogin}
                                        disabled={!ready || !!loadingMethod}
                                        className="w-full py-4 flex items-center justify-start gap-4 px-6 hover:bg-white/5 border border-white/10 hover:border-white/50 transition-all group"
                                    >
                                        <div className="p-2 bg-white/5 rounded-full group-hover:bg-white/20 transition-colors">
                                            {/* Google SVG */}
                                            <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z" fill="#FBBC05" />
                                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                            </svg>
                                        </div>
                                        <span className="font-medium">Continue with Google</span>
                                        {loadingMethod === 'google' && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
                                    </NeonButton>

                                    <div className="flex items-center gap-4 py-2">
                                        <div className="h-px bg-white/10 flex-1"></div>
                                        <span className="text-white/30 text-xs uppercase">OR</span>
                                        <div className="h-px bg-white/10 flex-1"></div>
                                    </div>

                                    <NeonButton
                                        variant="glass"
                                        onClick={handleWalletLogin}
                                        disabled={!ready}
                                        className="w-full py-4 flex items-center justify-start gap-4 px-6 bg-white hover:bg-white/90 border border-white transition-all group"
                                    >
                                        <div className="p-2 bg-black/20 rounded-full">
                                            <Wallet className="w-5 h-5 text-black" />
                                        </div>
                                        <span className="font-bold text-black">Connect Wallet</span>
                                    </NeonButton>
                                </motion.div>
                            )}

                            {/* EMAIL INPUT VIEW */}
                            {view === 'email-input' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                                    <div className="text-left space-y-2">
                                        <label className="text-xs text-neon-cyan font-bold uppercase tracking-wider ml-1">Email Address</label>
                                        <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-black/40 border-white/10 focus:border-neon-cyan text-lg py-6" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()} />
                                        {error && <p className="text-red-400 text-xs ml-1">{error}</p>}
                                    </div>
                                    <NeonButton variant="cyan" onClick={handleEmailSubmit} disabled={loadingMethod === 'email'} className="w-full py-4 font-bold text-black">{loadingMethod === 'email' ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Send Code"}</NeonButton>
                                </motion.div>
                            )}

                            {/* OTP INPUT VIEW */}
                            {view === 'otp-input' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                                    <div className="text-center mb-4"><p className="text-white/60 text-sm">Code sent to <span className="text-white font-medium">{email}</span></p></div>
                                    <div className="text-left space-y-2">
                                        <Input type="text" placeholder="123456" value={otp} maxLength={6} onChange={(e) => { const val = e.target.value.replace(/[^0-9]/g, ''); setOtp(val); if (val.length === 6) handleOtpSubmit(); }} className="bg-black/40 border-white/10 focus:border-neon-cyan text-2xl py-6 text-center tracking-[0.5em] font-mono" autoFocus />
                                        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                                    </div>
                                    <NeonButton variant="cyan" onClick={handleOtpSubmit} disabled={otp.length < 6 || loadingMethod === 'otp'} className="w-full py-4 font-bold text-black">{loadingMethod === 'otp' ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Verify & Login"}</NeonButton>
                                    <button onClick={() => setViewState('email-input')} className="text-white/40 text-xs hover:text-white transition-colors">Entered wrong email?</button>
                                </motion.div>
                            )}

                            {/* Footer */}
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="mt-8 flex flex-col gap-2">
                                <p className="text-[10px] text-white/30 uppercase tracking-widest font-mono flex items-center justify-center gap-2">
                                    <span>Powered by</span>
                                    <span className="text-neon-cyan font-bold glow-sm">BC400</span>
                                </p>
                            </motion.div>
                        </div>
                    </GlassCard>
                </motion.div>

                {/* Identity Modal Stub if needed */}
                <UsernameOnboardingModal isOpen={false} onClose={() => { }} suggestedUsername="" onSubmit={async (_username) => true} />
            </div>
        </AnimatePresence>
    );
}
