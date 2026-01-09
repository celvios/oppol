import { Request, Response } from 'express';
import { query } from '../config/database';
import { createRandomWallet } from '../services/web3';
import { encrypt } from '../services/encryption';

export const getWallet = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params; // In real app, get from Auth Middleware
        if (!userId) {
            res.status(400).json({ error: 'User ID required' });
            return;
        }

        const result = await query('SELECT id, public_address, balance FROM wallets WHERE user_id = $1', [userId]);

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Wallet not found' });
            return;
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Internal function to create wallet for a user
export const createWalletInternal = async (userId: string) => {
    const { address, privateKey } = createRandomWallet();
    const encryptedKey = encrypt(privateKey);

    const result = await query(
        'INSERT INTO wallets (user_id, public_address, encrypted_private_key) VALUES ($1, $2, $3) RETURNING id, public_address',
        [userId, address, encryptedKey]
    );
    return result.rows[0];
};

/**
 * Link a WalletConnect address to a custodial wallet
 * Creates user + custodial wallet if not exists
 * POST /api/wallet/link
 */
export const linkWallet = async (req: Request, res: Response) => {
    try {
        const { walletAddress } = req.body;

        if (!walletAddress) {
            res.status(400).json({ success: false, error: 'Wallet address required' });
            return;
        }

        // Normalize address to lowercase
        const normalizedAddress = walletAddress.toLowerCase();

        // Check if user already exists with this wallet address
        let userResult = await query(
            'SELECT id FROM users WHERE LOWER(wallet_address) = $1',
            [normalizedAddress]
        );

        let userId: string;

        if (userResult.rows.length === 0) {
            // Create new user with wallet address as identifier
            const newUser = await query(
                'INSERT INTO users (wallet_address, phone) VALUES ($1, $2) RETURNING id',
                [normalizedAddress, `web_${normalizedAddress.slice(0, 10)}`]
            );
            userId = newUser.rows[0].id;
        } else {
            userId = userResult.rows[0].id;
        }

        // Check if user has a custodial wallet
        let walletResult = await query(
            'SELECT id, public_address, balance FROM wallets WHERE user_id = $1',
            [userId]
        );

        let custodialWallet;
        if (walletResult.rows.length === 0) {
            // Create custodial wallet
            custodialWallet = await createWalletInternal(userId);
            custodialWallet.balance = '0';
        } else {
            custodialWallet = walletResult.rows[0];
        }

        res.json({
            success: true,
            userId,
            custodialAddress: custodialWallet.public_address,
            balance: custodialWallet.balance || '0'
        });
    } catch (error) {
        console.error('Error linking wallet:', error);
        res.status(500).json({ success: false, error: 'Failed to link wallet' });
    }
};
