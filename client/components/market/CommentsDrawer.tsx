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
    likes?: number;
    dislikes?: number;
    user_vote?: boolean; // true = like, false = dislike, null = none
    reply_count?: number;
    parent_id?: string;
    replies?: Comment[];
}

import { Heart, ThumbsDown, MessageSquare, ChevronDown, ChevronUp, CornerDownRight } from "lucide-react";

const CommentItem = ({ comment, isReply, onReply }: { comment: Comment, isReply: boolean, onReply: (id: string, name: string) => void }) => {
    const { address } = useWallet();
    const [likes, setLikes] = useState(parseInt(comment.likes as any || 0));
    const [dislikes, setDislikes] = useState(parseInt(comment.dislikes as any || 0));
    const [userVote, setUserVote] = useState<boolean | null>(comment.user_vote ?? null);
    const [showReplies, setShowReplies] = useState(false);
    const [replies, setReplies] = useState<Comment[]>([]);
    const [isLoadingReplies, setIsLoadingReplies] = useState(false);

    const handleVote = async (isLike: boolean) => {
        if (!address) return; // Prompt login

        // Optimistic UI update
        const previousVote = userVote;

        if (userVote === isLike) {
            // Remove vote
            setUserVote(null);
            if (isLike) setLikes(prev => prev - 1);
            else setDislikes(prev => prev - 1);
        } else {
            // Change or Add vote
            if (userVote === !isLike) {
                // Switch vote
                if (isLike) { setLikes(prev => prev + 1); setDislikes(prev => prev - 1); }
                else { setLikes(prev => prev - 1); setDislikes(prev => prev + 1); }
            } else {
                // Add new vote
                if (isLike) setLikes(prev => prev + 1);
                else setDislikes(prev => prev + 1);
            }
            setUserVote(isLike);
        }

        try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/comments/${comment.id}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: address,
                    isLike: userVote === isLike ? null : isLike
                })
            });
        } catch (err) {
            // Revert on error
            setUserVote(previousVote);
        }
    };

    const toggleReplies = async () => {
        if (!showReplies && replies.length === 0 && (comment.reply_count || 0) > 0) {
            setIsLoadingReplies(true);
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/comments/replies/${comment.id}?userId=${address ? encodeURIComponent(address) : ''}`);
                const data = await res.json();
                if (data.success) {
                    setReplies(data.replies);
                }
            } catch (err) {
                console.error("Failed to load replies", err);
            } finally {
                setIsLoadingReplies(false);
            }
        }
        setShowReplies(!showReplies);
    };

    // Formatter
    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        const now = new Date();
        const diff = (now.getTime() - date.getTime()) / 1000;

        if (diff < 60) return "Just now";
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
        return date.toLocaleDateString();
    };

    return (
        <div className={cn("flex flex-col w-full", isReply ? "mt-2 pl-2 border-l-2 border-white/10" : "mb-4")}>
            <div className="flex gap-3">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-800 border border-white/10 shrink-0">
                    <img
                        src={comment.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${comment.wallet_address}`}
                        alt="avatar"
                        className="w-full h-full object-cover"
                    />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-white text-sm truncate">{comment.display_name}</span>
                        <span className="text-white/40 text-xs">@{comment.wallet_address.slice(0, 6)}</span>
                        <span className="text-white/40 text-[10px]">• {formatTime(comment.created_at)}</span>
                    </div>

                    {/* Text */}
                    <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap break-words">{comment.text}</p>

                    {/* Actions Row */}
                    <div className="flex items-center gap-6 mt-2">
                        {/* Reply Button */}
                        <button
                            onClick={() => onReply(comment.id, comment.display_name)}
                            className="flex items-center gap-1.5 group text-white/50 hover:text-neon-cyan transition-colors"
                        >
                            <MessageSquare className="w-4 h-4" />
                            <span className="text-xs font-medium">{comment.reply_count || 0 > 0 ? comment.reply_count : 'Reply'}</span>
                        </button>

                        {/* Like Button */}
                        <button
                            onClick={() => handleVote(true)}
                            className={cn("flex items-center gap-1.5 group transition-colors", userVote === true ? "text-pink-500" : "text-white/50 hover:text-pink-500")}
                        >
                            <Heart className={cn("w-4 h-4", userVote === true && "fill-current")} />
                            <span className="text-xs font-medium">{likes > 0 && likes}</span>
                        </button>

                        {/* Dislike Button */}
                        <button
                            onClick={() => handleVote(false)}
                            className={cn("flex items-center gap-1.5 group transition-colors", userVote === false ? "text-red-500" : "text-white/50 hover:text-red-500")}
                        >
                            <ThumbsDown className={cn("w-4 h-4", userVote === false && "fill-current")} />
                            <span className="text-xs font-medium">{dislikes > 0 && dislikes}</span>
                        </button>
                    </div>

                    {/* View Replies Toggle */}
                    {(comment.reply_count || 0) > 0 && (
                        <button
                            onClick={toggleReplies}
                            className="mt-2 text-neon-cyan text-xs font-medium flex items-center gap-1 hover:underline"
                        >
                            {showReplies ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            {showReplies ? "Hide Replies" : `View ${comment.reply_count} replies`}
                        </button>
                    )}
                </div>
            </div>

            {/* Nested Replies */}
            <AnimatePresence>
                {showReplies && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden ml-4 pl-4"
                    >
                        {isLoadingReplies ? (
                            <div className="py-2 pl-8 flex items-center gap-2 text-white/30 text-xs">
                                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                Loading replies...
                            </div>
                        ) : (
                            replies.map(reply => (
                                <div className="relative mt-3" key={reply.id}>
                                    {/* Connecting Line */}
                                    {/* <div className="absolute -left-6 top-0 bottom-0 w-px bg-white/10 rounded" />
                                     <div className="absolute -left-6 top-4 w-4 h-px bg-white/10 rounded" /> */}
                                    <CommentItem
                                        comment={reply}
                                        isReply={true}
                                        onReply={onReply}
                                    />
                                </div>
                            ))
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

interface CommentsDrawerProps {
    marketId: string | number;
    isOpen: boolean;
    onClose: () => void;
}

export default function CommentsDrawer({ marketId, isOpen, onClose }: CommentsDrawerProps) {
    const { address, isConnected, connect } = useWallet();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState("");
    const [replyTo, setReplyTo] = useState<{ id: string, name: string } | null>(null);
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
        // Send via WebSocket
        socket.emit('send-comment', {
            marketId,
            text: newComment,
            walletAddress: address,
            parentId: replyTo?.id
        });

        setNewComment('');
        setReplyTo(null);
        setIsSending(false);
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
                            className="flex-1 overflow-y-auto p-4 space-y-4 font-sans"
                        >
                            {comments.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-text-secondary opacity-50">
                                    <MessageCircle className="w-12 h-12 mb-2" />
                                    <p>No comments yet. Be the first!</p>
                                </div>
                            ) : (
                                comments.map((c) => (
                                    <CommentItem
                                        key={c.id}
                                        comment={c}
                                        isReply={false}
                                        onReply={(id, name) => setReplyTo({ id, name })}
                                    />
                                ))
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="p-4 border-t border-white/10 bg-white/5 relative z-10">
                            {replyTo && (
                                <div className="flex items-center justify-between bg-white/5 px-3 py-1.5 rounded-t-lg text-xs text-white/60">
                                    <span className="flex items-center gap-1">
                                        <CornerDownRight className="w-3 h-3" />
                                        Replying to <span className="text-neon-cyan font-bold">@{replyTo.name}</span>
                                    </span>
                                    <button onClick={() => setReplyTo(null)} className="hover:text-white">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            )}

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
                                        placeholder={replyTo ? `Reply to ${replyTo.name}...` : "Type a comment..."}
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
