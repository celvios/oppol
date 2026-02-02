import { Request, Response } from 'express';
import { query } from '../config/database';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createWalletInternal } from './walletController';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

// Step 1: User (via Bot) requests a login link
// Magic Link generation removed
export const generateMagicLink = async (req: Request, res: Response) => {
    res.status(410).json({ error: 'Magic Link login is deprecated. Please use Wallet Connect.' });
};

// Step 2: User clicks link on Frontend -> Frontend calls this API
// Magic Link verification removed
export const verifyMagicToken = async (req: Request, res: Response) => {
    res.status(410).json({ error: 'Magic Link verification is deprecated.' });
};
// Step 3: Register User (Privy/Wallet)
export const registerUser = async (req: Request, res: Response) => {
    try {
        const { walletAddress, email } = req.body;

        if (!walletAddress) {
            return res.status(400).json({ success: false, error: 'Wallet address required' });
        }

        console.log(`[Auth] Registering user: ${walletAddress}`);

        try {
            // Check if user exists
            const existingUser = await query(
                'SELECT * FROM users WHERE LOWER(wallet_address) = $1',
                [walletAddress.toLowerCase()]
            );

            if (existingUser.rows.length > 0) {
                console.log(`[Auth] User exists: ${existingUser.rows[0].id}`);
                return res.json({ success: true, user: existingUser.rows[0], isNew: false });
            }

            // Create new user
            const displayName = email ? email.split('@')[0] : `User ${walletAddress.slice(0, 6)}`;
            const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${walletAddress}`;

            const newUser = await query(
                'INSERT INTO users (wallet_address, display_name, avatar_url) VALUES ($1, $2, $3) RETURNING *',
                [walletAddress.toLowerCase(), displayName, avatarUrl]
            );

            console.log(`[Auth] Created new user: ${newUser.rows[0].id}`);
            return res.json({ success: true, user: newUser.rows[0], isNew: true });
        } catch (dbError: any) {
            // FALLBACK FOR OFFLINE DEVELOPMENT
            if (dbError.code === 'ECONNREFUSED' || dbError.message.includes('connect')) {
                console.warn('⚠️ Register DB failed. Returning MOCK user for offline dev.');
                const mockUser = {
                    id: 'mock-user-uuid',
                    wallet_address: walletAddress,
                    display_name: email ? email.split('@')[0] : `Mock User ${walletAddress.slice(0, 4)}`,
                    avatar_url: `https://api.dicebear.com/7.x/identicon/svg?seed=${walletAddress}`,
                    created_at: new Date().toISOString()
                };
                return res.json({ success: true, user: mockUser, isNew: true, mock: true });
            }
            throw dbError; // Re-throw real errors
        }

    } catch (error: any) {
        console.error('Register user error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};
