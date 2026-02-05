"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, MessageCircle, Heart, ThumbsDown, X } from "lucide-react";
import { useWallet } from "@/lib/use-wallet";
import NeonButton from "@/components/ui/NeonButton";
import { cn } from "@/lib/utils";
import { getSocket } from "@/lib/socket";
import { motion, AnimatePresence } from "framer-motion";

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

interface CommentsSectionProps {
    marketId: string | number;
    className?: string;
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
    const [, setIsLoadingReplies] = useState(false);

    // Sync user_vote when comment prop updates (after reload)
    useEffect(() => {
        if (comment.user_vote !== undefined) {
            setUserVote(comment.user_vote);
        }
        if (comment.likes !== undefined) {
            setLikes(parseInt(comment.likes as any || 0));
        }
    }, [comment.user_vote, comment.likes]);

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
                else setLikes(p => p - 1);
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
                const url = `${process.env.NEXT_PUBLIC_API_URL}/api/comments/replies/${comment.id}${address ? `?walletAddress=${encodeURIComponent(address)}` : ''}`;
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

export default function CommentsSection({ marketId, className }: CommentsSectionProps) {
    const { address, isConnected, connect } = useWallet();
    const [comments, setComments] = useState<Comment[]>([]);

    // Input state
    const [newComment, setNewComment] = useState("");
    const [replyTo, setReplyTo] = useState<{ id: string, name: string } | null>(null);
    const [isSending, setIsSending] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);

    // Initial Fetch
    const fetchComments = useCallback(async () => {
        try {
            const url = `${process.env.NEXT_PUBLIC_API_URL}/api/comments/${marketId}${address ? `?walletAddress=${encodeURIComponent(address)}` : ''}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setComments(data.comments);
            }
        } catch (error) {
            console.error("Failed to load comments", error);
        }
    }, [marketId, address]);

    useEffect(() => {
        fetchComments();
    }, [fetchComments]);

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
        // Root comment: Append to end (Chat Style) or Start (Feed Style) - Using Feed Style
        return [newComment, ...nodes];
    };

    // Socket Listener
    useEffect(() => {
        if (!marketId) return;

        const socket = getSocket();

        const joinRoom = () => socket.emit('join-market', marketId);
        joinRoom();
        socket.on('connect', joinRoom);

        const handleNewComment = (comment: Comment) => {
            setComments(prev => {
                // Check if this comment already exists (by ID)
                const existingIndex = prev.findIndex(c => c.id === comment.id);
                if (existingIndex !== -1) return prev;

                // Helper function to find and replace temp comment in tree
                const replaceTempComment = (nodes: Comment[]): Comment[] => {
                    return nodes.map(node => {
                        // Check if this node is the temp comment we're looking for
                        if (node.id.startsWith('temp-') &&
                            node.wallet_address === comment.wallet_address &&
                            (node.text === comment.text || node.text.trim() === comment.text.trim())) {
                            return comment;
                        }

                        // Check replies recursively
                        if (node.replies && node.replies.length > 0) {
                            const updatedReplies = replaceTempComment(node.replies);
                            // Check if any reply was replaced
                            const replyReplaced = updatedReplies.some((reply, idx) =>
                                reply.id === comment.id && node.replies![idx].id.startsWith('temp-')
                            );
                            if (replyReplaced) {
                                return { ...node, replies: updatedReplies };
                            }
                        }

                        return node;
                    });
                };

                // Check if there's a temp comment to replace
                // We'll relax the check slightly to ensure we catch it
                const hasTempComment = prev.some(c =>
                    c.id.startsWith('temp-') &&
                    c.wallet_address === comment.wallet_address &&
                    (c.text === comment.text || c.text.trim() === comment.text.trim())
                ) || prev.some(c =>
                    c.replies?.some(r =>
                        r.id.startsWith('temp-') &&
                        r.wallet_address === comment.wallet_address &&
                        (r.text === comment.text || r.text.trim() === comment.text.trim())
                    )
                );

                if (hasTempComment) {
                    // Replace temp comment with real one
                    return replaceTempComment(prev);
                }

                // New comment - add it
                if (!comment.parent_id) {
                    // New Root Comment: Prepend to top (Feed Style)
                    return [comment, ...prev];
                }
                return addCommentToTree(prev, comment);
            });
        };

        socket.on('new-comment', handleNewComment);

        return () => {
            socket.emit('leave-market', marketId);
            socket.off('new-comment', handleNewComment);
            socket.off('connect', joinRoom);
        };
    }, [marketId]);

    const handleSend = async () => {
        if (!newComment.trim() || !address) return;
        setIsSending(true);

        const commentText = newComment.trim();
        const parentId = replyTo?.id;

        // Optimistic update: Add comment immediately to UI
        const tempId = `temp-${Date.now()}-${Math.random()}`;
        const optimisticComment: Comment = {
            id: tempId,
            text: commentText,
            created_at: new Date().toISOString(),
            display_name: 'You',
            wallet_address: address,
            likes: 0,
            dislikes: 0,
            reply_count: 0,
            parent_id: parentId || undefined
        };

        // Add optimistically
        setComments(prev => {
            if (parentId) {
                return addCommentToTree(prev, optimisticComment);
            }
            return [optimisticComment, ...prev];
        });

        const socket = getSocket();
        socket.emit('send-comment', {
            marketId,
            text: commentText,
            walletAddress: address,
            parentId: parentId
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
        <div className={cn("flex flex-col bg-surface border border-white/5 rounded-xl overflow-hidden", className)}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5 backdrop-blur-xl z-20">
                <h2 className="font-heading font-bold text-lg text-white">Discussion</h2>
                <div className="text-xs text-white/50">{comments.length} comments</div>
            </div>

            {/* Input Area (Top for Feed Style, or Bottom for Chat Style - keeping user pref usually bottom but for sections usually top is easier for "Post new") 
               Wait, existing drawer had input at bottom. For an inline section, input at top is often better for "Write a comment", but let's stick to a standard structure.
               Actually, let's put input at the top for the section view so it's accessible without scrolling down everything.
            */}
            <div className="p-4 border-b border-white/10 bg-white/[0.02]">
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
                            placeholder="Share your thoughts..."
                            className="flex-1 bg-transparent !border-none !outline-none focus:ring-0 text-white placeholder:text-white/30 text-[15px] py-2.5 min-w-0"
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

            {/* List */}
            <div className="max-h-[600px] overflow-y-auto custom-scrollbar p-4 space-y-4">
                {comments.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-white/30">
                        <MessageCircle className="w-12 h-12 mb-4 opacity-50" />
                        <p>No comments yet. Be the first!</p>
                    </div>
                ) : (
                    comments.map(c => (
                        <div key={c.id} className="relative">
                            <CommentItem
                                comment={c}
                                onReply={handleReplyClick}
                            />
                            {/* Separator */}
                            <div className="absolute -bottom-2 left-0 w-full h-px bg-white/5" />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
