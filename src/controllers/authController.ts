import { Request, Response } from 'express';
import { query } from '../config/database';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createWalletInternal, getActiveProxyWallet } from './walletController';
import { createRandomWallet } from '../services/web3';
import { EncryptionService } from '../services/encryption';
import { watchAddress } from '../services/depositWatcher';

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
                console.log(`[Auth] User exists: ${existingUser.rows[0].id}. Checking for profile update...`);

                // Allow profile update for existing users (fixing the "infinite prompt" loop)
                const { username, customUsername } = req.body;
                const requestedName = username || customUsername;

                if (requestedName) {
                    // Check uniqueness for the NEW name (excluding self)
                    const nameCheck = await query(
                        'SELECT id FROM users WHERE LOWER(display_name) = LOWER($1) AND id != $2',
                        [requestedName, existingUser.rows[0].id]
                    );

                    if (nameCheck.rows.length > 0) {
                        console.log(`[Auth] Username taken: ${requestedName}`);
                        return res.status(409).json({
                            success: false,
                            error: 'Username taken. Please choose another.',
                            usernameTaken: true
                        });
                    }

                    // Update the user
                    const updatedUser = await query(
                        'UPDATE users SET display_name = $1 WHERE id = $2 RETURNING *',
                        [requestedName, existingUser.rows[0].id]
                    );

                    console.log(`[Auth] Updated existing user with new name: ${requestedName}`);
                    return res.json({ success: true, user: updatedUser.rows[0], isNew: false, updated: true });
                }

                return res.json({ success: true, user: existingUser.rows[0], isNew: false });
            }

            // --- Username Uniqueness Logic ---
            const { username, customUsername } = req.body;
            let displayName = username || customUsername;

            console.log(`[Auth] New User Registration. Requested Name: '${displayName}', Wallet: ${walletAddress}`);

            if (!displayName) {
                // Generate default if not provided
                displayName = email ? email.split('@')[0] : `User ${walletAddress.slice(0, 6)}`;
                console.log(`[Auth] No username provided. Generated default: '${displayName}'`);
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
// Step 4: Login with Google/Email via Privy
export const authenticatePrivyUser = async (req: Request, res: Response) => {
    try {
        const { privyUserId, email, walletAddress, loginMethod } = req.body;

        if (!privyUserId) {
            return res.status(400).json({ success: false, error: 'Privy User ID required' });
        }

        console.log(`[Auth] Privy Auth: ${privyUserId} (${email || 'No Email'}) Method: ${loginMethod || 'Unknown'}`);

        // Check if user exists by Privy ID
        let queryText = 'SELECT * FROM users WHERE privy_user_id = $1';
        let queryParams: any[] = [privyUserId];

        // Secondary check by email REMOVED as column does not exist
        // if (email) { ... } 

        const existingUserResult = await query(queryText, queryParams);
        let user = existingUserResult.rows[0];

        // LOGIC FOR CUSTODIAL WALLETS (Google/Email users)
        // If login method is social/email, we want to control the keys.
        const isCustodial = loginMethod === 'google' || loginMethod === 'email' || loginMethod === 'twitter' || loginMethod === 'discord';

        let custodialWalletAddress = null;

        if (user) {
            // User exists, update fields
            let updates = [];
            let updateParams = [];
            let paramCounter = 1;

            if (!user.privy_user_id) {
                updates.push(`privy_user_id = $${paramCounter++}`);
                updateParams.push(privyUserId);
            }
            // Email update REMOVED

            if (updates.length > 0) {
                updateParams.push(user.id);
                await query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCounter}`, updateParams);
            }

            // Check if they need a custodial wallet (if they are a custodial user type)
            if (isCustodial) {
                // Check wallets table
                const walletCheck = await query('SELECT public_address, encrypted_private_key FROM wallets WHERE user_id = $1', [user.id]);
                if (walletCheck.rows.length > 0) {
                    // Derive the Pimlico Smart Account address — gas is sponsored by Pimlico,
                    // fee is deducted from deposit amount. SA is the canonical on-chain address.
                    try {
                        const pk = EncryptionService.decrypt(walletCheck.rows[0].encrypted_private_key);
                        const { smartAccountAddress: saAddr } = await getActiveProxyWallet(pk, user.id.toString());
                        custodialWalletAddress = saAddr;
                        // Keep users.wallet_address in sync with SA
                        if (user.wallet_address !== saAddr) {
                            await query('UPDATE users SET wallet_address = $1 WHERE id = $2', [saAddr, user.id]);
                            user.wallet_address = saAddr;
                        }
                        console.log(`[Auth] Custodial SA wallet: ${saAddr}`);
                    } catch (e) {
                        console.error('[Auth] Failed to derive SA address, falling back to EOA:', e);
                        custodialWalletAddress = walletCheck.rows[0].public_address;
                    }
                } else {
                    // Create new custodial wallet
                    console.log(`[Auth] Generating Custodial Wallet for existing user ${user.id}`);
                    const newWallet = await createWalletInternal(user.id);
                    try {
                        const pk = EncryptionService.decrypt(newWallet.encrypted_private_key || '');
                        const { smartAccountAddress: saAddr } = await getActiveProxyWallet(pk, user.id.toString());
                        custodialWalletAddress = saAddr;
                        await query('UPDATE users SET wallet_address = $1 WHERE id = $2', [saAddr, user.id]);
                        user.wallet_address = saAddr;
                    } catch (e) {
                        console.error('[Auth] Failed to derive SA on creation, falling back to EOA:', e);
                        custodialWalletAddress = newWallet.public_address;
                        await query('UPDATE users SET wallet_address = $1 WHERE id = $2', [custodialWalletAddress, user.id]);
                        user.wallet_address = custodialWalletAddress;
                    }
                    // Watch the SA address for deposits
                    watchAddress(custodialWalletAddress!, user.id, '');
                }
            }

        } else {
            // New User
            console.log(`[Auth] Creating new Privy user`);

            // Generate unique display name
            let displayName = email ? email.split('@')[0] : `User ${walletAddress?.slice(0, 6) || 'Anon'}`;
            const nameCheck = await query('SELECT id FROM users WHERE display_name = $1', [displayName]);
            if (nameCheck.rows.length > 0) {
                displayName = `${displayName}${Math.floor(Math.random() * 1000)}`;
            }

            // IF Custodial: Generate wallet FIRST to use as their main address
            // IF Not: Use provided walletAddress
            let finalWalletAddress = walletAddress;

            if (isCustodial || !walletAddress) {
                // We will create the user first with a placeholder or the provided address, then update with custodial
                // Actually better to just use provided address initially if available, then override?
                // Let's use provided address as placeholder if exists, else random
                if (!finalWalletAddress) finalWalletAddress = '0x0000000000000000000000000000000000000000';
            }

            const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${displayName}`;

            const newUserResult = await query(
                'INSERT INTO users (privy_user_id, wallet_address, display_name, avatar_url) VALUES ($1, $2, $3, $4) RETURNING *',
                [privyUserId, finalWalletAddress, displayName, avatarUrl]
            );
            user = newUserResult.rows[0];

            if (isCustodial) {
                console.log(`[Auth] Generating Custodial Wallet for new user ${user.id}`);
                const newWallet = await createWalletInternal(user.id);
                try {
                    const pk = EncryptionService.decrypt(newWallet.encrypted_private_key || '');
                    const { smartAccountAddress: saAddr } = await getActiveProxyWallet(pk, user.id.toString());
                    custodialWalletAddress = saAddr;
                    await query('UPDATE users SET wallet_address = $1 WHERE id = $2', [saAddr, user.id]);
                    user.wallet_address = saAddr;
                    console.log(`[Auth] 🚀 SA address for new user: ${saAddr}`);
                } catch (e) {
                    console.error('[Auth] Failed to derive SA on new user, falling back to EOA:', e);
                    custodialWalletAddress = newWallet.public_address;
                    await query('UPDATE users SET wallet_address = $1 WHERE id = $2', [custodialWalletAddress, user.id]);
                    user.wallet_address = custodialWalletAddress;
                }
                // Watch the SA address for deposits
                watchAddress(custodialWalletAddress!, user.id, '');
            }
        }

        return res.json({
            success: true,
            user: user,
            isNew: !existingUserResult.rows.length,
            isCustodial: !!custodialWalletAddress,
            custodialAddress: custodialWalletAddress
        });

    } catch (error: any) {
        console.error('Privy auth error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

