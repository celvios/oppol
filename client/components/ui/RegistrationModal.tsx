import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '@/lib/use-wallet';
import NeonButton from '@/components/ui/NeonButton';
import { Sparkles, Ghost, Smile } from 'lucide-react';

interface RegistrationModalProps {
    isOpen: boolean;
    onRegister: () => void;
}

export default function RegistrationModal({ isOpen, onRegister }: RegistrationModalProps) {
    const { address } = useWallet();
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!username.trim()) {
            setError('Yo! Need a name, mysterious stranger!');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: address,
                    username: username.trim()
                })
            });

            const data = await res.json();
            if (data.success) {
                onRegister();
            } else {
                setError(data.error || 'Something exploded. Try again.');
            }
        } catch (err) {
            setError('Network gremlins ate your request.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <motion.div
                    initial={{ scale: 0.5, rotate: -10, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    exit={{ scale: 0.5, rotate: 10, opacity: 0 }}
                    transition={{ type: "spring", bounce: 0.5 }}
                    className="bg-zinc-900 border-2 border-neon-cyan p-8 rounded-3xl max-w-md w-full shadow-[0_0_50px_rgba(6,182,212,0.3)] relative overflow-hidden"
                >
                    {/* Floating background elements */}
                    <motion.div
                        animate={{ y: [0, -20, 0], rotate: [0, 10, 0] }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="absolute -top-10 -right-10 text-neon-purple opacity-20"
                    >
                        <Ghost size={100} />
                    </motion.div>

                    <div className="relative z-10 text-center space-y-6">
                        <motion.div
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="inline-block bg-neon-cyan/20 p-4 rounded-full mb-2"
                        >
                            <Sparkles className="w-12 h-12 text-neon-cyan" />
                        </motion.div>

                        <div>
                            <h2 className="text-3xl font-heading font-bold text-white mb-2">
                                Who are you?! 😎🔶
                            </h2>
                            <p className="text-gray-400">
                                Connect a name to that fancy wallet address.
                                We'll give you a cool avatar too!
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter super cool alias..."
                                    className="w-full bg-black/50 border-2 border-white/10 rounded-xl px-4 py-4 text-lg text-center focus:border-neon-cyan focus:outline-none transition-colors placeholder:text-gray-600"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                                />
                                {username && (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500"
                                    >
                                        <Smile size={24} />
                                    </motion.div>
                                )}
                            </div>

                            {error && (
                                <motion.p
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-red-400 text-sm font-bold"
                                >
                                    {error}
                                </motion.p>
                            )}

                            <NeonButton
                                variant="cyan"
                                className="w-full"
                                onClick={handleSubmit}
                                disabled={!username.trim()}
                            >
                                {loading ? 'Making magic happens...' : '✨ Let Me In! ✨'}
                            </NeonButton>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
