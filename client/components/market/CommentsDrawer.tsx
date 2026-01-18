"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, MessageCircle, User } from "lucide-react";
import { useWallet } from "@/lib/use-wallet";
import NeonButton from "@/components/ui/NeonButton";
import { cn } from "@/lib/utils";
import { getSocket } from "@/lib/socket";
import { useUIStore } from "@/lib/store";

interface Comment {
    id: string;
    text: string;
    created_at: string;
    display_name: string;
    wallet_address: string;
    avatar_url?: string;
}

interface CommentsDrawerProps {
    marketId: string | number;
    isOpen: boolean;
    onClose: () => void;
}

export default function CommentsDrawer({ marketId, isOpen, onClose }: CommentsDrawerProps) {
    const { address, isConnected, connect } = useWallet();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Fetch comments and setup WebSocket
    useEffect(() => {
        if (!isOpen || marketId === undefined) return;

        const socket = getSocket();

        // Function to join the room
        const joinRoom = () => {
            console.log(`🔌 Joining market room: market-${marketId}`);
            socket.emit('join-market', marketId);
        };

        // Join immediately
        joinRoom();

        // Also join on reconnection
        socket.on('connect', joinRoom);

        // Listen for new comments in real-time
        const handleNewComment = (comment: Comment) => {
            console.log('🔔 Frontend received new comment:', comment);
            setComments(prev => {
                // Check if comment already exists
                if (prev.some(c => c.id === comment.id)) return prev;
                return [...prev, comment];
            });
        };

        const handleCommentError = (data: { error: string }) => {
            console.error('Comment error:', data.error);
        };

        socket.on('new-comment', handleNewComment);
        socket.on('comment-error', handleCommentError);

        // Initial fetch via HTTP
        fetchComments();

        // Cleanup on unmount
        return () => {
            console.log(`🔌 Leaving market room: market-${marketId}`);
            socket.emit('leave-market', marketId);
            socket.off('new-comment', handleNewComment);
            socket.off('comment-error', handleCommentError);
            socket.off('connect', joinRoom);
        };
    }, [isOpen, marketId]);

    // Auto-scroll to bottom on new comments
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [comments]);

    const fetchComments = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/comments/${marketId}`);
            const data = await res.json();
            if (data.success) {
                // Reverse simply to show newest at bottom if chat-style, 
                // but usually API returns DESC (newest first). 
                // Let's assume we want newest at *bottom* for chat flow, so we reverse the DESC list.
                setComments(data.comments.reverse());
            }
        } catch (error) {
            console.error("Failed to load comments", error);
        }
    };

    const handleSend = async () => {
        if (!newComment.trim() || !address) return;

        setIsSending(true);

        const socket = getSocket();

        console.log('📤 Sending comment via WebSocket:', { marketId, text: newComment, walletAddress: address });

        // Send via WebSocket
        socket.emit('send-comment', {
            marketId,
            text: newComment,
            walletAddress: address
        });

        setNewComment('');
        setIsSending(false);
    };

    // Date formatter
    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 z-[60] backdrop-blur-sm"
                    />

                    {/* Drawer (Right Side on Desktop, Bottom Sheet on Mobile) */}
                    <motion.div
                        initial={{ x: "100%", y: 0 }} // Desktop default
                        animate={{ x: 0, y: 0 }}
                        exit={{ x: "100%", y: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className={cn(
                            "fixed z-[70] bg-void/90 backdrop-blur-xl border-l border-white/10 shadow-2xl flex flex-col",
                            // Responsive Positioning
                            "right-0 top-0 bottom-0 w-full md:w-[400px]", // Desktop: Right Sidebar
                            "md:border-l border-t md:border-t-0 rounded-t-2xl md:rounded-none", // Mobile: Top rounded corners
                            // Mobile overrides via media query if needed for Bottom Sheet style, 
                            // but generic right-side slide is also fine for mobile navs. 
                            // Let's make it a bottom sheet on mobile properly:
                            "max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:h-[80vh] max-md:translate-x-0",
                        )}
                        // Override animation for mobile
                        variants={{
                            desktop: { x: "100%", y: 0 },
                            mobile: { x: 0, y: "100%" }
                        }}
                        style={{ transformOrigin: "bottom right" }} // optimization
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                            <div className="flex items-center gap-2">
                                <MessageCircle className="w-5 h-5 text-neon-cyan" />
                                <h2 className="font-heading font-bold text-lg">Market Chat</h2>
                                <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-text-secondary">
                                    {comments.length}
                                </span>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Comments List */}
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-4 space-y-4"
                        >
                            {comments.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-text-secondary opacity-50">
                                    <MessageCircle className="w-12 h-12 mb-2" />
                                    <p>No comments yet. Be the first!</p>
                                </div>
                            ) : (
                                comments.map((c) => {
                                    const isMe = address && c.wallet_address?.toLowerCase() === address.toLowerCase();
                                    return (
                                        <div
                                            key={c.id}
                                            className={cn(
                                                "flex w-full mb-4 items-end gap-2",
                                                isMe ? "justify-end" : "justify-start"
                                            )}
                                        >
                                            {/* Avatar (Left for others) */}
                                            {!isMe && (
                                                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-800 border border-white/10 shrink-0">
                                                    <img
                                                        src={c.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${c.wallet_address}`}
                                                        alt="avatar"
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            )}

                                            <div className={cn(
                                                "max-w-[85%] rounded-2xl px-4 py-3 text-sm relative shadow-sm",
                                                isMe
                                                    ? "bg-emerald-600 text-white rounded-br-none" // Green for sending
                                                    : "bg-rose-700 text-white rounded-bl-none" // Red for receiving
                                            )}>
                                                {/* Author Name */}
                                                {!isMe && (
                                                    <div className="text-[10px] text-white/70 mb-1 font-bold flex items-center gap-1">
                                                        {c.display_name}
                                                    </div>
                                                )}

                                                <p className="leading-relaxed break-words">{c.text}</p>

                                                {/* Timestamp */}
                                                <div className={cn(
                                                    "text-[10px] mt-1 opacity-70",
                                                    isMe ? "text-right" : "text-left"
                                                )}>
                                                    {formatTime(c.created_at)}
                                                </div>
                                            </div>

                                            {/* Avatar (Right for me) */}
                                            {isMe && (
                                                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-800 border border-white/10 shrink-0">
                                                    <img
                                                        src={c.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${c.wallet_address}`}
                                                        alt="avatar"
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="p-4 border-t border-white/10 bg-white/5">
                            {!isConnected ? (
                                <NeonButton
                                    variant="cyan"
                                    className="w-full"
                                    onClick={connect}
                                >
                                    Connect Wallet to Chat
                                </NeonButton>
                            ) : (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                        onFocus={() => useUIStore.getState().setInputFocused(true)}
                                        onBlur={() => useUIStore.getState().setInputFocused(false)}
                                        placeholder="Type something..."
                                        className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-neon-cyan/50 transition-colors"
                                        disabled={isSending}
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={!newComment.trim() || isSending}
                                        className="p-3 bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
