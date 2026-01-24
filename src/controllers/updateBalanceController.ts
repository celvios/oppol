import { Request, Response } from 'express';
import { query } from '../config/database';

export const updateUserBalance = async (req: Request, res: Response) => {
    try {
        const { walletAddress, custodialWallet, balance } = req.body;
        
        if (!walletAddress || !custodialWallet || !balance) {
            return res.status(400).json({ 
                error: 'Missing required fields: walletAddress, custodialWallet, balance' 
            });
        }

        console.log(`Updating balance for user: ${walletAddress}`);
        
        // Check if user exists
        const userResult = await query(
            'SELECT id FROM users WHERE LOWER(wallet_address) = $1',
            [walletAddress.toLowerCase()]
        );
        
        let userId;
        if (userResult.rows.length === 0) {
            const createResult = await query(
                'INSERT INTO users (wallet_address, created_at) VALUES ($1, NOW()) RETURNING id',
                [walletAddress]
            );
            userId = createResult.rows[0].id;
        } else {
            userId = userResult.rows[0].id;
        }
        
        // Update or create custodial wallet record
        const walletResult = await query(
            'SELECT id FROM wallets WHERE user_id = $1',
            [userId]
        );
        
        if (walletResult.rows.length === 0) {
            await query(
                'INSERT INTO wallets (user_id, public_address, balance, created_at) VALUES ($1, $2, $3, NOW())',
                [userId, custodialWallet, balance]
            );
        } else {
            await query(
                'UPDATE wallets SET public_address = $1, balance = $2, updated_at = NOW() WHERE user_id = $3',
                [custodialWallet, balance, userId]
            );
        }
        
        res.json({
            success: true,
            message: `User balance updated: ${balance} USDC`,
            data: {
                userId,
                walletAddress,
                custodialWallet,
                balance
            }
        });
        
    } catch (error: any) {
        console.error('Error updating user balance:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update balance'
        });
    }
};