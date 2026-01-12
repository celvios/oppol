'use client';

import { useState } from 'react';
import { X, Wallet, Loader2 } from 'lucide-react';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLogin: (address: string) => Promise<{ success: boolean; error?: string }>;
}

export function LoginModal({ isOpen, onClose, onLogin }: LoginModalProps) {
    const [address, setAddress] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const result = await onLogin(address);
        
        if (result.success) {
            onClose();
            setAddress('');
        } else {
            setError(result.error || 'Failed to login');
        }
        
        setIsLoading(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-surface border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-white/40 hover:text-white"
                >
                    <X size={20} />
                </button>

                <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                        <Wallet className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Enter Wallet Address</h2>
                    <p className="text-white/50 text-sm">
                        Enter your wallet address to sign in
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="0x..."
                            required
                            className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 font-mono text-sm"
                        />
                    </div>

                    {error && (
                        <div className="text-red-400 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || !address}
                        className="w-full py-3 bg-primary hover:bg-primary/80 disabled:bg-white/5 disabled:text-white/20 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Signing in...
                            </>
                        ) : (
                            'Continue'
                        )}
                    </button>
                </form>

                <p className="text-white/30 text-xs text-center mt-6">
                    By continuing, you agree to our Terms of Service
                </p>
            </div>
        </div>
    );
}
