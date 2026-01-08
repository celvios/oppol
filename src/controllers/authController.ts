import { Request, Response } from 'express';
import { query } from '../config/database';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createWalletInternal } from './walletController';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

// Step 1: User (via Bot) requests a login link
export const generateMagicLink = async (req: Request, res: Response) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) {
            res.status(400).json({ error: 'Phone Number required' });
            return;
        }

        // 1. Find or Create User
        let userResult = await query('SELECT id FROM users WHERE phone_number = $1', [phoneNumber]);
        let userId;

        if (userResult.rows.length === 0) {
            // New User -> Create User
            const newUser = await query('INSERT INTO users (phone_number) VALUES ($1) RETURNING id', [phoneNumber]);
            userId = newUser.rows[0].id;
            // Create Wallet for new user
            await createWalletInternal(userId);
        } else {
            userId = userResult.rows[0].id;
        }

        // 2. Generate Magic Token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await query('INSERT INTO auth_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)', [token, userId, expiresAt]);

        // 3. Return the Link (In prod, this would be sent to the Bot to send to user)
        // For development/MVP we return it in the response so we can test easily
        const magicLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?token=${token}`;

        res.json({ success: true, link: magicLink, userId });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Step 2: User clicks link on Frontend -> Frontend calls this API
export const verifyMagicToken = async (req: Request, res: Response) => {
    try {
        const { token } = req.body;
        if (!token) {
            res.status(400).json({ error: 'Token required' });
            return;
        }

        const result = await query('SELECT * FROM auth_tokens WHERE token = $1', [token]);

        if (result.rows.length === 0) {
            res.status(401).json({ error: 'Invalid token' });
            return;
        }

        const tokenData = result.rows[0];

        if (tokenData.used) {
            res.status(401).json({ error: 'Token already used' });
            return;
        }

        if (new Date() > new Date(tokenData.expires_at)) {
            res.status(401).json({ error: 'Token expired' });
            return;
        }

        // Mark as used
        await query('UPDATE auth_tokens SET used = TRUE WHERE token = $1', [token]);

        // Generate Session JWT
        const sessionToken = jwt.sign({ userId: tokenData.user_id }, JWT_SECRET, { expiresIn: '7d' });

        res.json({ success: true, token: sessionToken });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
