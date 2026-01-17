import express from 'express';
import { query } from '../config/database';

const router = express.Router();

// GET /api/comments/:marketId - Fetch comments for a market
router.get('/:marketId', async (req, res) => {
    try {
        const { marketId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const result = await query(
            `SELECT c.id, c.market_id, c.text, c.created_at, 
                    u.wallet_address, 
                    COALESCE(u.display_name, u.phone_number, 'Web User') as display_name,
                    u.avatar_url
             FROM comments c
             JOIN users u ON c.user_id = u.id
             WHERE c.market_id = $1
             ORDER BY c.created_at DESC
             LIMIT $2 OFFSET $3`,
            [marketId, limit, offset]
        );

        res.json({ success: true, comments: result.rows });
    } catch (error: any) {
        console.error('Fetch comments error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/comments - Post a new comment
router.post('/', async (req, res) => {
    try {
        const { marketId, text, walletAddress } = req.body;

        if (!marketId || !text || !walletAddress) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // 1. Find User
        const userResult = await query(
            'SELECT id FROM users WHERE LOWER(wallet_address) = $1',
            [walletAddress.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'User not found. Please connect wallet.' });
        }

        const userId = userResult.rows[0].id;

        // 2. Insert Comment
        const insertResult = await query(
            `INSERT INTO comments (market_id, user_id, text)
             VALUES ($1, $2, $3)
             RETURNING id, created_at`,
            [marketId, userId, text]
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
                displayName: 'You'
            }
        });

    } catch (error: any) {
        console.error('Post comment error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
