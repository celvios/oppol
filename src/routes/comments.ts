import express from 'express';
import { query } from '../config/database';

const router = express.Router();

// GET /api/comments/:marketId - Fetch comments for a market (Threaded)
router.get('/:marketId', async (req, res) => {
    try {
        const { marketId } = req.params;
        const { limit = 50, offset = 0, userId } = req.query; // userId optional to check if liked

        // Fetch top-level comments with stats
        const result = await query(
            `SELECT c.id, c.market_id, c.text, c.created_at, c.parent_id,
                    u.wallet_address, 
                    COALESCE(u.display_name, u.phone_number, 'Web User') as display_name,
                    u.avatar_url,
                    (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.is_like = TRUE) as likes,
                    (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.is_like = FALSE) as dislikes,
                    (SELECT COUNT(*) FROM comments r WHERE r.parent_id = c.id) as reply_count,
                    ${userId ? `(SELECT is_like FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = $4) as user_vote,` : 'NULL as user_vote,'}
                    CASE WHEN c.parent_id IS NULL THEN 'ROOT' ELSE 'REPLY' END as type
             FROM comments c
             JOIN users u ON c.user_id = u.id
             WHERE c.market_id = $1 AND c.parent_id IS NULL
             ORDER BY c.created_at DESC
             LIMIT $2 OFFSET $3`,
            userId ? [marketId, limit, offset, userId] : [marketId, limit, offset]
        );

        res.json({ success: true, comments: result.rows });
    } catch (error: any) {
        console.error('Fetch comments error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/comments/replies/:commentId - Fetch replies for a comment
router.get('/replies/:commentId', async (req, res) => {
    try {
        const { commentId } = req.params;
        const { userId } = req.query;

        const result = await query(
            `SELECT c.id, c.market_id, c.text, c.created_at, c.parent_id,
                    u.wallet_address, 
                    COALESCE(u.display_name, u.phone_number, 'Web User') as display_name,
                    u.avatar_url,
                    (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.is_like = TRUE) as likes,
                    (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.is_like = FALSE) as dislikes,
                    ${userId ? `(SELECT is_like FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = $2) as user_vote` : 'NULL as user_vote'}
             FROM comments c
             JOIN users u ON c.user_id = u.id
             WHERE c.parent_id = $1
             ORDER BY c.created_at ASC`,
            userId ? [commentId, userId] : [commentId]
        );

        res.json({ success: true, replies: result.rows });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/comments - Post a new comment (or reply)
router.post('/', async (req, res) => {
    try {
        const { marketId, text, walletAddress, parentId } = req.body;

        if (!marketId || !text || !walletAddress) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const userResult = await query(
            'SELECT id FROM users WHERE LOWER(wallet_address) = $1',
            [walletAddress.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'User not found' });
        }

        const userId = userResult.rows[0].id;

        const insertResult = await query(
            `INSERT INTO comments (market_id, user_id, text, parent_id)
             VALUES ($1, $2, $3, $4)
             RETURNING id, created_at`,
            [marketId, userId, text, parentId || null]
        );

        const newComment = insertResult.rows[0];

        res.json({
            success: true,
            comment: {
                id: newComment.id,
                marketId,
                text,
                createdAt: newComment.created_at,
                walletAddress,
                displayName: 'You',
                parentId: parentId || null,
                likes: 0,
                dislikes: 0,
                reply_count: 0
            }
        });

    } catch (error: any) {
        console.error('Post comment error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/comments/:commentId/vote - Like or Dislike
router.post('/:commentId/vote', async (req, res) => {
    try {
        const { commentId } = req.params;
        const { walletAddress, isLike } = req.body; // isLike: true = like, false = dislike, null = remove

        const userResult = await query(
            'SELECT id FROM users WHERE LOWER(wallet_address) = $1',
            [walletAddress.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'User not found' });
        }
        const userId = userResult.rows[0].id;

        if (isLike === null) {
            // Remove vote
            await query('DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2', [commentId, userId]);
        } else {
            // Upsert vote
            await query(
                `INSERT INTO comment_likes (comment_id, user_id, is_like)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (comment_id, user_id) 
                 DO UPDATE SET is_like = $3`,
                [commentId, userId, isLike]
            );
        }

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
