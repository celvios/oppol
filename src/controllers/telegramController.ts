import { Request, Response } from 'express';
import pool from '../config/database';
import { CustodialWalletService } from '../services/custodialWallet';
import { ethers } from 'ethers';
import { EncryptionService } from '../services/encryption';

// Use correct environment variables matching .env
const MARKET_CONTRACT_ADDRESS = process.env.MARKET_CONTRACT || process.env.MULTI_MARKET_ADDRESS || '0xB6a211822649a61163b94cf46e6fCE46119D3E1b';
const USDC_ADDRESS = process.env.USDC_CONTRACT || '0x16E4A3d9697D47c61De3bDD1DdDa4148aA09D634';
const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';

// ABI for PredictionMarketMulti contract
const PREDICTION_MARKET_ABI = [
    'function buyShares(uint256 marketId, uint256 outcomeIndex, uint256 shares, uint256 maxCost) external',
    'function userBalances(address) view returns (uint256)',
    'function deposit(uint256 amount) external',
    'function calculateCost(uint256 marketId, uint256 outcomeIndex, uint256 shares) view returns (uint256)'
];

const USDC_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function balanceOf(address account) external view returns (uint256)',
    'function transfer(address to, uint256 amount) external returns (bool)'
];

export class TelegramController {
    static async getOrCreateUser(req: Request, res: Response) {
        try {
            const { telegramId, username } = req.body;

            let result = await pool.query(
                'SELECT * FROM telegram_users WHERE telegram_id = $1',
                [telegramId]
            );

            if (result.rows.length === 0) {
                const wallet = await CustodialWalletService.createWallet(telegramId.toString());
                result = await pool.query(
                    'INSERT INTO telegram_users (telegram_id, username, wallet_address, encrypted_private_key) VALUES ($1, $2, $3, $4) RETURNING *',
                    [telegramId, username, wallet.address, wallet.encryptedPrivateKey]
                );
            }

            res.json({ success: true, user: result.rows[0] });
        } catch (error) {
            console.error('Get/Create user error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    static async placeBet(req: Request, res: Response) {
        try {
            const { telegramId, marketId, outcome, amount } = req.body;

            let userResult = await pool.query(
                'SELECT * FROM telegram_users WHERE telegram_id = $1',
                [telegramId]
            );

            // Auto-create user if not found (mock DB loses data on restart)
            if (userResult.rows.length === 0) {
                console.log('[Telegram Bet] User not found, auto-creating...');
                const wallet = await CustodialWalletService.createWallet(telegramId.toString());
                userResult = await pool.query(
                    'INSERT INTO telegram_users (telegram_id, username, wallet_address, encrypted_private_key) VALUES ($1, $2, $3, $4) RETURNING *',
                    [telegramId, 'telegram_user', wallet.address, wallet.encryptedPrivateKey]
                );
                console.log('[Telegram Bet] User auto-created with wallet:', wallet.address);
            }

            const user = userResult.rows[0];
            const provider = new ethers.JsonRpcProvider(RPC_URL);

            // Decrypt private key
            const privateKey = EncryptionService.decrypt(user.encrypted_private_key);
            const wallet = new ethers.Wallet(privateKey, provider);

            // Convert amount to wei (USDC has 6 decimals)
            const amountInWei = ethers.parseUnits(amount.toString(), 6);

            console.log('[Telegram Bet Debug]', {
                USDC_ADDRESS,
                MARKET_CONTRACT_ADDRESS,
                RPC_URL,
                userWallet: wallet.address,
                amount: amountInWei.toString()
            });

            // Approve USDC spending
            const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet);
            const approveTx = await usdcContract.approve(MARKET_CONTRACT_ADDRESS, amountInWei);
            await approveTx.wait();

            // Place bet
            const marketContract = new ethers.Contract(MARKET_CONTRACT_ADDRESS, PREDICTION_MARKET_ABI, wallet);
            // Use buyShares with outcomeIndex (0=Yes, 1=No), shares amount, and max cost
            const maxCost = amountInWei * BigInt(2); // Allow 2x slippage
            const betTx = await marketContract.buyShares(marketId, outcome, amountInWei, maxCost);
            const receipt = await betTx.wait();

            // Store transaction
            await pool.query(
                'INSERT INTO telegram_transactions (telegram_id, type, market_id, outcome, amount, tx_hash, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [telegramId, 'BET', marketId, outcome, amount, receipt.hash, 'CONFIRMED']
            );

            res.json({
                success: true,
                message: 'Bet placed successfully',
                transactionHash: receipt.hash
            });
        } catch (error: any) {
            console.error('Place bet error:', error);

            // Provide user-friendly error messages
            let userMessage = 'Failed to place bet';

            if (error.code === 'INSUFFICIENT_FUNDS' || error.message?.includes('insufficient funds')) {
                userMessage = 'Insufficient BNB for gas fees. Please deposit BNB to your wallet first.';
            } else if (error.message?.includes('insufficient allowance') || error.message?.includes('transfer amount exceeds balance')) {
                userMessage = 'Insufficient USDC balance. Please deposit USDC first.';
            } else if (error.message?.includes('execution reverted')) {
                userMessage = 'Transaction failed. The market may be closed or your balance is too low.';
            }

            res.status(400).json({ success: false, message: userMessage });
        }
    }

    static async getBalance(req: Request, res: Response) {
        try {
            const { telegramId } = req.params;

            const result = await pool.query(
                'SELECT wallet_address FROM telegram_users WHERE telegram_id = $1',
                [telegramId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            const walletAddress = result.rows[0].wallet_address;
            const provider = new ethers.JsonRpcProvider(RPC_URL);
            const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

            const balance = await usdcContract.balanceOf(walletAddress);
            const balanceFormatted = ethers.formatUnits(balance, 6);

            res.json({ success: true, balance: parseFloat(balanceFormatted) });
        } catch (error: any) {
            console.error('Get balance error:', error);
            res.status(500).json({ success: false, message: error.message || 'Server error' });
        }
    }

    static async withdraw(req: Request, res: Response) {
        try {
            const { telegramId, toAddress, amount } = req.body;

            const userResult = await pool.query(
                'SELECT * FROM telegram_users WHERE telegram_id = $1',
                [telegramId]
            );

            if (userResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            const user = userResult.rows[0];
            const provider = new ethers.JsonRpcProvider(RPC_URL);
            const privateKey = EncryptionService.decrypt(user.encrypted_private_key);
            const wallet = new ethers.Wallet(privateKey, provider);
            const amountInWei = ethers.parseUnits(amount.toString(), 6);

            const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet);
            const tx = await usdcContract.transfer(toAddress, amountInWei);
            const receipt = await tx.wait();

            await pool.query(
                'INSERT INTO telegram_transactions (telegram_id, type, amount, tx_hash, status) VALUES ($1, $2, $3, $4, $5)',
                [telegramId, 'WITHDRAW', amount, receipt.hash, 'CONFIRMED']
            );

            res.json({ success: true, message: 'Withdrawal successful', transactionHash: receipt.hash });
        } catch (error: any) {
            console.error('Withdraw error:', error);
            res.status(500).json({ success: false, message: error.message || 'Server error' });
        }
    }
}
