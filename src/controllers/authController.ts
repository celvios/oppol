import { Request, Response } from 'express';
import { query } from '../config/database';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createWalletInternal } from './walletController';
import { createRandomWallet } from '../services/web3';
import { EncryptionService } from '../services/encryption';

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
            // Check if user exists (Wallet Address)
            const existingUser = await query(
                'SELECT * FROM users WHERE LOWER(wallet_address) = $1',
                [walletAddress.toLowerCase()]
            );

            if (existingUser.rows.length > 0) {
                console.log(`[Auth] User exists: ${existingUser.rows[0].id}`);
                return res.json({ success: true, user: existingUser.rows[0], isNew: false });
            }

            // --- Username Uniqueness Logic ---
            const { customUsername } = req.body;
            let displayName = customUsername;

            if (!displayName) {
                // Generate default if not provided
                displayName = email ? email.split('@')[0] : `User ${walletAddress.slice(0, 6)}`;
            }

            // Check if display_name exists (Case-insensitive)
            const nameCheck = await query(
                'SELECT id FROM users WHERE LOWER(display_name) = LOWER($1)',
                [displayName]
            );

            if (nameCheck.rows.length > 0) {
                // Name is taken!
                // If the user explicitly provided this name, or if it was auto-generated and conflict occurred
                console.log(`[Auth] Username conflict for: ${displayName}`);
                return res.status(409).json({
                    success: false,
                    error: 'Username taken',
                    usernameTaken: true,
                    suggestion: `${displayName}${Math.floor(Math.random() * 1000)}`
                });
            }

            // Create new user with verified unique name
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
// Step 4: Login with Google
export const loginWithGoogle = async (req: Request, res: Response) => {
    try {
        const { email, googleId, name, avatar } = req.body;

        if (!email || !googleId) {
            return res.status(400).json({ success: false, error: 'Email and Google ID required' });
        }

        console.log(`[Auth] Google Login: ${email}`);

        // Check if user exists by Google ID or Email
        const existingUser = await query(
            'SELECT * FROM users WHERE google_id = $1 OR email = $2',
            [googleId, email]
        );

        if (existingUser.rows.length > 0) {
            const user = existingUser.rows[0];

            // Update Google ID if missing (for legacy email match)
            if (!user.google_id) {
                await query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, user.id]);
            }

            // Get Wallet
            const wallet = await query('SELECT public_address FROM wallets WHERE user_id = $1', [user.id]);
            const walletAddress = wallet.rows[0]?.public_address;

            return res.json({
                success: true,
                user: { ...user, wallet_address: walletAddress },
                isNew: false
            });
        }

        // New User -> Create Custodial Wallet
        console.log(`[Auth] Creating new user for ${email}`);

        // 1. Create Wallet
        const { address, privateKey } = createRandomWallet();
        const encryptedKey = EncryptionService.encrypt(privateKey);

        // 2. Create User
        // Generate unique display name
        let displayName = name || email.split('@')[0];
        // Ensure uniqueness (simple append)
        const nameCheck = await query('SELECT id FROM users WHERE display_name = $1', [displayName]);
        if (nameCheck.rows.length > 0) {
            displayName = `${displayName}${Math.floor(Math.random() * 1000)}`;
        }

        const newUser = await query(
            'INSERT INTO users (email, google_id, display_name, avatar_url, wallet_address) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [email, googleId, displayName, avatar || '', address]
        );
        const userId = newUser.rows[0].id;

        // 3. Save Custodial Wallet
        await query(
            'INSERT INTO wallets (user_id, public_address, encrypted_private_key) VALUES ($1, $2, $3)',
            [userId, address, encryptedKey]
        );

        console.log(`[Auth] Created user ${userId} with wallet ${address}`);

        return res.json({
            success: true,
            user: { ...newUser.rows[0], wallet_address: address },
            isNew: true
        });

    } catch (error: any) {
        console.error('Google login error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};
