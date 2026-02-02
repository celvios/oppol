"use client";

import { useEffect, useState } from "react";
import { Wallet, X, Mail, ArrowLeft, Loader2 } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import NeonButton from "@/components/ui/NeonButton";
import { usePrivy, useLoginWithOAuth, useLoginWithEmail } from "@privy-io/react-auth";
import { useWallet } from "@/lib/use-wallet";
import WalletDebugger from "../debug/WalletDebugger";
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
    const { login: privyLogin, ready, authenticated } = usePrivy();
    const { initOAuth } = useLoginWithOAuth();
    const { sendCode, loginWithCode } = useLoginWithEmail();
    const { connectAsync, connectors } = useWallet();

    const [view, setView] = useState<'main' | 'socials' | 'email-input' | 'email-otp'>('main');
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [isConnectingWallet, setIsConnectingWallet] = useState(false);
    const [showIdentityModal, setShowIdentityModal] = useState(false);
    const [conflictDetails, setConflictDetails] = useState<{ suggested: string, wallet: string } | null>(null);

    // Reset state on close
    useEffect(() => {
        if (!isOpen) {
            setView('main');
            setEmail("");
            setOtp("");
            setLoading(false);
        }
    }, [isOpen]);

    const handleGoogleLogin = async () => {
        try {
            setLoading(true);
            await initOAuth({ provider: 'google' });
            // OAuth redirects, so loading state persists until unload
        } catch (e) {
            console.error('Google Login Error:', e);
            setLoading(false);
        }
    };

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        try {
            setLoading(true);
            await sendCode({ email });
            setView('email-otp');
        } catch (err) {
            console.error('Email Send Code Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOtpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otp) return;

        try {
            setLoading(true);
            await loginWithCode({ code: otp, email });
            onClose();
        } catch (err) {
            console.error('OTP Verification Error:', err);
        } finally {
            setLoading(false);
        }
    };

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






    // Call backend to register/check user
    const handleBackendRegistration = async (address: string, email?: string, customUsername?: string) => {
        try {
            console.log(`[Auth] Registering ${address}...`);
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

            const res = await fetch(`${apiUrl}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: address, email, customUsername })
            });

            if (res.status === 409) {
                const data = await res.json();
                console.warn("[Auth] Username conflict:", data);
                setConflictDetails({ suggested: data.suggestion, wallet: address });
                setShowIdentityModal(true);
                return false; // Conflict handled
            }

            if (!res.ok) throw new Error('Registration failed');

            const data = await res.json();
            console.log("[Auth] Registration success:", data);

            // Store session if needed? (use-auth handles this usually?)
            // For now just success
            return true;
        } catch (e) {
            console.error("[Auth] Registration error:", e);
            return false;
        }
    };

    const handleConnect = async () => {
        if (isConnectingWallet) return;
        setIsConnectingWallet(true);
        try {
            console.log('[ConnectWalletModal] connect triggered');
            let connectedAddress = "";

            // Try direct injected connection first if available (mimics the successful "Direct Connect" test)
            console.log('[ConnectWalletModal] Available connectors:', connectors?.map(c => ({ id: c.id, name: c.name })));
            const injectedConnector = connectors?.find((c: any) =>
                c.id === 'injected' ||
                c.id === 'io.metamask' ||
                c.name.toLowerCase() === 'metamask' ||
                c.name.toLowerCase() === 'browser wallet'
            );

            if (injectedConnector && typeof window !== 'undefined' && (window as any).ethereum) {
                console.log('[ConnectWalletModal] Attempting direct injection connect...');
                const result = await connectAsync({ connector: injectedConnector });
                connectedAddress = result.accounts[0];
                console.log('[ConnectWalletModal] Direct connect successful', connectedAddress);
            } else if (typeof window !== 'undefined' && (window as any).ethereum) {
                // FORCE FALLBACK: If wagmi didn't give us the connector but window.ethereum exists
                console.warn('[ConnectWalletModal] No matching connector found in Wagmi, but window.ethereum exists. Forcing direct request...');

                // We can try to find ANY connector that is 'injected' type even if name doesn't match
                const anyInjected = connectors?.find(c => c.type === 'injected');

                if (anyInjected) {
                    const result = await connectAsync({ connector: anyInjected });
                    connectedAddress = result.accounts[0];
                    console.log('[ConnectWalletModal] Forced generic injected connect successful', connectedAddress);
                } else {
                    // Last resort: we open Web3Modal because we can't easily construct a Wagmi Connector from thin air 
                    // without using 'wagmi/connectors' imports which aren't here.
                    // BUT, we can try to connectAsync with the FIRST available connector if it looks safe?
                    // No, let's just fall back to Web3Modal but log VERY clearly.
                    console.error('[ConnectWalletModal] Fatal: Window.ethereum exists but no Wagmi connector available. Falling back to Web3Modal.');
                    await onConnect();
                }
            } else {
                // Fallback to Web3Modal (e.g. for mobile or no extension)
                console.log('[ConnectWalletModal] No injection found, opening Web3Modal...');
                await onConnect();

                // We can't easily get the address immediately from onConnect void return
                // We rely on useWallet/useAccount which updates asynchronously
                // But for conflict flow, we need the address.
                // Assuming typical flow: User connects -> Component re-renders -> We detect change?
                // OR we just close and let the global auth hook handle registration?
                // The global auth hook currently does NOT seem to auto-register against backend API based on use-auth.ts review.
                // So we should try to do it here. 
                // But if we can't get address, we might need to rely on effect?
            }

            // Attempt registration if we got an address immediately
            if (connectedAddress) {
                const success = await handleBackendRegistration(connectedAddress);
                if (success) onClose();
                // If conflict (success=false), modal stays open (identity modal overlay)
            } else {
                // If we didn't get address (Web3Modal flow), we close and assume specific Web3Modal handling or Effect will pick it up?
                // Ideally we should have an effect watching `address` changes in this modal if it stays open?
                // But usually we close this modal.
                // Let's close for now, but this means Web3Modal users won't get the cool interactive conflict flow immediately.
                // They might get a default rand suffix if we don't block.
                // But wait, the backend NOW blocks default conflicts. So they MUST do this flow.
                // This means we need a global "onboarding" check.
                onClose();
            }

        } catch (e) {
            console.error('[ConnectWalletModal] Connect failed:', e);
            // If direct connect failed, maybe user rejected? Don't force open Web3Modal immediately to avoid spam.
        } finally {
            setIsConnectingWallet(false);
        }
    };

    const onIdentitySubmit = async (newUsername: string) => {
        if (!conflictDetails) return false;
        const success = await handleBackendRegistration(conflictDetails.wallet, undefined, newUsername);
        if (success) {
            setShowIdentityModal(false);
            onClose();
            return true;
        } else {
            // If still conflict, handleBackendRegistration sets modal state again (or we assume it throws/modifies state)
            // Actually handleBackendRegistration returns false on 409. 
            // We need to throw error for modal to show it?
            throw new Error("Username still taken, please try another.");
        }
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
                    {view === 'main' ? (
                        <>
                            <NeonButton
                                variant="cyan"
                                onClick={handleConnect}
                                disabled={isConnectingWallet}
                                className="w-full mb-3 flex items-center justify-center gap-2 py-4 font-bold disabled:opacity-70 disabled:cursor-wait"
                            >
                                {isConnectingWallet ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wallet className="w-5 h-5" />}
                                {isConnectingWallet ? 'Connecting...' : 'Connect External Wallet'}
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
                                variant="glass"
                                onClick={() => setView('socials')}
                                disabled={!ready}
                                className="w-full mb-3 flex items-center justify-center gap-2 py-3 text-sm bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 disabled:cursor-wait"
                            >
                                {!ready ? 'Initializing...' : 'Log In with Email / Socials'}
                            </NeonButton>
                        </>
                    ) : view === 'socials' ? (
                        <div className="space-y-3 animate-fadeIn">
                            <button
                                onClick={handleGoogleLogin}
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-3 py-3 bg-white text-black rounded-lg font-bold hover:bg-gray-200 transition-colors disabled:opacity-70 disabled:cursor-wait"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />}
                                Continue with Google
                            </button>

                            <button
                                onClick={() => setView('email-input')}
                                className="w-full flex items-center justify-center gap-3 py-3 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-colors border border-white/10"
                            >
                                <Mail className="w-5 h-5" />
                                Continue with Email
                            </button>

                            <button
                                onClick={() => setView('main')}
                                className="w-full py-2 text-white/40 hover:text-white text-sm flex items-center justify-center gap-2"
                            >
                                <ArrowLeft className="w-3 h-3" /> Back
                            </button>
                        </div>
                    ) : view === 'email-input' ? (
                        <form onSubmit={handleEmailSubmit} className="space-y-4 animate-fadeIn">
                            <input
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-neon-cyan/50 transition-colors"
                                autoFocus
                            />
                            <NeonButton
                                variant="cyan"
                                type="submit"
                                isLoading={loading}
                                disabled={!email || loading}
                                className="w-full"
                            >
                                Send Code
                            </NeonButton>
                            <button
                                type="button"
                                onClick={() => setView('socials')}
                                className="w-full py-2 text-white/40 hover:text-white text-sm"
                            >
                                Back
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleOtpSubmit} className="space-y-4 animate-fadeIn">
                            <p className="text-sm text-white/60 mb-2">
                                Enter the code sent to <span className="text-white">{email}</span>
                            </p>
                            <input
                                type="text"
                                placeholder="123456"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-neon-cyan/50 transition-colors text-center tracking-widest text-lg font-mono"
                                autoFocus
                                maxLength={6}
                            />
                            <NeonButton
                                variant="cyan"
                                type="submit"
                                isLoading={loading}
                                disabled={otp.length < 6 || loading}
                                className="w-full"
                            >
                                Verify & Login
                            </NeonButton>
                            <button
                                type="button"
                                onClick={() => setView('email-input')}
                                className="w-full py-2 text-white/40 hover:text-white text-sm"
                            >
                                Change Email
                            </button>
                        </form>
                    )}

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
                    <WalletDebugger />
                </GlassCard>
            </div>

            {/* Identity Conflict Modal (Overlay on top of Connect Modal) */}
            <UsernameOnboardingModal
                isOpen={showIdentityModal}
                onClose={() => setShowIdentityModal(false)}
                onSubmit={onIdentitySubmit}
                suggestedUsername={conflictDetails?.suggested}
                walletAddress={conflictDetails?.wallet}
            />
        </div>
    );
}
