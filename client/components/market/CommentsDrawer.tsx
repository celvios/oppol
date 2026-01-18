"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, MessageCircle, Heart, ThumbsDown, Repeat2 } from "lucide-react";
import { useWallet } from "@/lib/use-wallet";
import NeonButton from "@/components/ui/NeonButton";
import { cn } from "@/lib/utils";
import { getSocket } from "@/lib/socket";
import { useUIStore } from "@/lib/store";

// Types
interface Comment {
    id: string;
    text: string;
    created_at: string;
    display_name: string;
    wallet_address: string;
    avatar_url?: string;
    likes?: number;
    dislikes?: number;
    user_vote?: boolean;
    reply_count?: number;
    parent_id?: string;
    replies?: Comment[];
}

interface CommentsDrawerProps {
    marketId: string | number;
    isOpen: boolean;
    onClose: () => void;
}

const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000;

    if (diff < 60) return `${Math.floor(diff)}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// ----------------------------------------------------------------------
// Comment Item Component (X-Style)
// ----------------------------------------------------------------------
const CommentItem = ({
    comment,
    onReply,
    level = 0
}: {
    comment: Comment,
    onReply: (id: string, name: string) => void,
    level?: number
}) => {
    const { address } = useWallet();
    const [likes, setLikes] = useState(parseInt(comment.likes as any || 0));
    const [userVote, setUserVote] = useState<boolean | null>(comment.user_vote ?? null);

    // Reply handling
    const [replies, setReplies] = useState<Comment[]>(comment.replies || []);
    const [showReplies, setShowReplies] = useState(false);
    const [isLoadingReplies, setIsLoadingReplies] = useState(false);

    // Sync local replies if prop updates
    useEffect(() => {
        if (comment.replies) {
            setReplies(comment.replies);
        }
    }, [comment.replies]);

    const handleVote = async (isLike: boolean, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!address) return;

        const previousVote = userVote;

        // Optimistic Update
        if (userVote === isLike) {
            setUserVote(null);
            if (isLike) setLikes(p => p - 1);
        } else {
            if (userVote === !isLike) {
                if (isLike) setLikes(p => p + 1);
                else setLikes(p => p - 1); // If switching from dislike, logic varies but simplicity: just track likes for X style usually
            } else {
                if (isLike) setLikes(p => p + 1);
            }
            setUserVote(isLike);
        }

        try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/comments/${comment.id}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: address, isLike: userVote === isLike ? null : isLike })
            });
        } catch (err) {
            setUserVote(previousVote);
        }
    };

    const toggleReplies = async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!showReplies && replies.length === 0 && (comment.reply_count || 0) > 0) {
            setIsLoadingReplies(true);
            try {
                const url = `${process.env.NEXT_PUBLIC_API_URL}/api/comments/replies/${comment.id}?userId=${address ? encodeURIComponent(address) : ''}`;
                const res = await fetch(url);
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

    return (
        <div className={cn("flex flex-col w-full animate-in fade-in slide-in-from-bottom-2 duration-300", level > 0 && "mt-3")}>
            <div className="flex gap-3 relative">
                {/* Avatar Column */}
                <div className="flex flex-col items-center shrink-0 w-10 relative">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-white/5 border border-white/10 z-10">
                        <img
                            src={comment.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${comment.wallet_address}`}
                            alt="avatar"
                            className="w-full h-full object-cover"
                        />
                    </div>
                    {/* Vertical Line for Threads */}
                    {showReplies && replies.length > 0 && (
                        <div className="w-[2px] bg-white/10 absolute top-10 bottom-0 grow -mb-3" />
                    )}
                </div>

                {/* Content Column */}
                <div className="flex-1 min-w-0 pb-1">
                    {/* Header */}
                    <div className="flex items-center gap-2 text-[15px] leading-tight mb-0.5">
                        <span className="font-bold text-white truncate">{comment.display_name}</span>
                        <span className="text-white/40 font-normal truncate">@{comment.wallet_address.slice(0, 6)}</span>
                        <span className="text-white/40 text-[10px]">•</span>
                        <span className="text-white/40 font-normal">{formatTime(comment.created_at)}</span>
                    </div>

                    {/* Text */}
                    <div className="text-white/90 text-[15px] leading-normal whitespace-pre-wrap break-words mt-0.5 font-sans">
                        {comment.text}
                    </div>

                    {/* Actions Bar */}
                    <div className="flex items-center justify-between max-w-[300px] mt-3 pr-4">
                        {/* Reply */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onReply(comment.id, comment.display_name); }}
                            className="group flex items-center gap-1.5 text-white/40 hover:text-neon-cyan transition-colors"
                        >
                            <div className="p-1.5 -ml-1.5 rounded-full group-hover:bg-neon-cyan/10 transition-colors">
                                <MessageCircle className="w-[18px] h-[18px]" />
                            </div>
                            <span className="text-xs font-medium">{comment.reply_count || 0 > 0 ? comment.reply_count : ''}</span>
                        </button>

                        {/* Like */}
                        <button
                            onClick={(e) => handleVote(true, e)}
                            className={cn("group flex items-center gap-1.5 transition-colors", userVote === true ? "text-pink-500" : "text-white/40 hover:text-pink-500")}
                        >
                            <div className="p-1.5 rounded-full group-hover:bg-pink-500/10 transition-colors">
                                <Heart className={cn("w-[18px] h-[18px]", userVote === true && "fill-current")} />
                            </div>
                            <span className="text-xs font-medium">{likes > 0 && likes}</span>
                        </button>

                        {/* Dislike (Subtle) */}
                        <button
                            onClick={(e) => handleVote(false, e)}
                            className={cn("group flex items-center gap-1.5 transition-colors", userVote === false ? "text-white" : "text-white/40 hover:text-white")}
                        >
                            <div className="p-1.5 rounded-full group-hover:bg-white/10 transition-colors">
                                <ThumbsDown className={cn("w-[18px] h-[18px]", userVote === false && "fill-current")} />
                            </div>
                        </button>

                        {/* Share / More */}
                        <button className="group text-white/40 hover:text-neon-cyan transition-colors">
                            <div className="p-1.5 rounded-full group-hover:bg-neon-cyan/10 transition-colors">
                                <Repeat2 className="w-[18px] h-[18px]" />
                            </div>
                        </button>
                    </div>

                    {/* Show Replies Text Link */}
                    {(!showReplies && (comment.reply_count || 0) > 0) && (
                        <div
                            onClick={(e) => toggleReplies(e)}
                            className="mt-3 text-neon-cyan text-sm font-medium hover:underline cursor-pointer flex items-center gap-2"
                        >
                            <div className="h-px w-8 bg-white/10" />
                            Show {comment.reply_count} replies
                        </div>
                    )}
                </div>
            </div>

            {/* Render Replies */}
            <AnimatePresence>
                {showReplies && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                    >
                        {replies.map((reply) => (
                            <CommentItem
                                key={reply.id}
                                comment={reply}
                                onReply={onReply}
                                level={level + 1}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default function CommentsDrawer({ marketId, isOpen, onClose }: CommentsDrawerProps) {
    const { address, isConnected, connect } = useWallet();
    const [comments, setComments] = useState<Comment[]>([]);

    // Input state
    const [newComment, setNewComment] = useState("");
    const [replyTo, setReplyTo] = useState<{ id: string, name: string } | null>(null);
    const [isSending, setIsSending] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Initial Fetch
    const fetchComments = useCallback(async () => {
        try {
            const url = `${process.env.NEXT_PUBLIC_API_URL}/api/comments/${marketId}?userId=${address ? encodeURIComponent(address) : ''}`;
            console.log('📡 CommentsDrawer: Fetching comments from', url);
            const res = await fetch(url);
            const data = await res.json();
            console.log('📡 CommentsDrawer: Fetch response:', data);
            if (data.success) {
                console.log('📡 CommentsDrawer: Setting', data.comments.length, 'comments');
                setComments(data.comments);
                // Auto scroll to bottom
                setTimeout(() => {
                    if (scrollRef.current) {
                        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    }
                }, 100);
            }
        } catch (error) {
            console.error("Failed to load comments", error);
        }
    }, [marketId, address]);

    // Initial Fetch Effect
    useEffect(() => {
        if (isOpen) {
            fetchComments();
        }
    }, [isOpen, fetchComments]);

    // Scroll to bottom when comments change (if new message added)
    useEffect(() => {
        // Optional: Add logic here if needed to auto-scroll only on certain conditions
    }, [comments.length]); // Dependencies

    // Recursive State Update Function
    const addCommentToTree = (nodes: Comment[], newComment: Comment): Comment[] => {
        if (newComment.parent_id) {
            return nodes.map(node => {
                if (node.id === newComment.parent_id) {
                    return {
                        ...node,
                        replies: [...(node.replies || []), newComment], // Append reply (Oldest Top)
                        reply_count: (node.reply_count || 0) + 1
                    };
                }
                if (node.replies) {
                    return {
                        ...node,
                        replies: addCommentToTree(node.replies, newComment)
                    };
                }
                return node;
            });
        }
        // Root comment: Append to end (Chat Style)
        return [...nodes, newComment];
    };

    // Socket Listener
    useEffect(() => {
        if (!isOpen || marketId === undefined) return;

        const socket = getSocket();
        console.log('🔌 CommentsDrawer: Setting up socket for market', marketId);

        const joinRoom = () => {
            console.log('🔌 CommentsDrawer: Joining room market-' + marketId);
            socket.emit('join-market', marketId);
        };
        joinRoom();
        socket.on('connect', joinRoom);

        const handleNewComment = (comment: Comment) => {
            console.log('🔔 CommentsDrawer: Received new-comment event:', comment);
            setComments(prev => {
                if (prev.some(c => c.id === comment.id)) {
                    console.log('🔔 CommentsDrawer: Duplicate comment, skipping');
                    return prev;
                }

                if (!comment.parent_id) {
                    console.log('🔔 CommentsDrawer: Adding root comment to state');
                    return [comment, ...prev];
                }
                return addCommentToTree(prev, comment);
            });
        };

        socket.on('new-comment', handleNewComment);

        return () => {
            console.log('🔌 CommentsDrawer: Leaving room market-' + marketId);
            socket.emit('leave-market', marketId);
            socket.off('new-comment', handleNewComment);
            socket.off('connect', joinRoom);
        };
    }, [isOpen, marketId]);

    const handleSend = async () => {
        if (!newComment.trim() || !address) return;
        setIsSending(true);

        const socket = getSocket();
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

    const handleReplyClick = (id: string, name: string) => {
        setReplyTo({ id, name });
        setTimeout(() => inputRef.current?.focus(), 100);
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
                        className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-[2px]"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        className={cn(
                            "fixed z-[70] bg-[#000000] border-l border-white/10 shadow-2xl flex flex-col",
                            "right-0 top-0 bottom-0 w-full md:w-[450px]",
                            "max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:h-[90vh] max-md:rounded-t-2xl max-md:border-t"
                        )}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5 backdrop-blur-xl z-20">
                            <h2 className="font-heading font-bold text-lg text-white">Comments</h2>
                            <button onClick={onClose} className="p-2 -mr-2 text-white/50 hover:text-white rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* List */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                            <div className="p-4 pb-32 min-h-full">
                                {comments.length === 0 ? (
                                    <div className="h-64 flex flex-col items-center justify-center text-white/30">
                                        <MessageCircle className="w-12 h-12 mb-4 opacity-50" />
                                        <p>No comments yet.</p>
                                    </div>
                                ) : (
                                    comments.map(c => (
                                        <div key={c.id} className="mb-2 relative">
                                            <CommentItem
                                                comment={c}
                                                onReply={handleReplyClick}
                                            />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Input Area */}
                        <div className="absolute bottom-0 inset-x-0 bg-black/80 backdrop-blur-xl border-t border-white/10 p-4 z-30">
                            {replyTo && (
                                <div className="flex items-center justify-between text-xs text-white/50 mb-2 pl-2">
                                    <span>Replying to <span className="text-neon-cyan">@{replyTo.name}</span></span>
                                    <button onClick={() => setReplyTo(null)}><X className="w-3 h-3 hover:text-white" /></button>
                                </div>
                            )}

                            {!isConnected ? (
                                <NeonButton variant="cyan" className="w-full" onClick={connect}>
                                    Connect to Comment
                                </NeonButton>
                            ) : (
                                <div className="flex items-end gap-2 bg-white/5 rounded-2xl p-2 border border-white/10 focus-within:border-neon-cyan/50 focus-within:bg-black/50 transition-all">

                                    <input
                                        ref={inputRef}
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                        placeholder="Post your reply"
                                        className="flex-1 bg-transparent !border-none !outline-none focus:ring-0 text-white placeholder:text-white/30 text-[15px] py-2.5 max-h-32 min-w-0"
                                        disabled={isSending}
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={!newComment.trim() || isSending}
                                        className="p-2 mb-0.5 text-neon-cyan hover:bg-neon-cyan/10 rounded-full transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
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
