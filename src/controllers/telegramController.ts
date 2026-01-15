import { Request, Response } from 'express';
import pool from '../config/database';
import { CustodialWalletService } from '../services/custodialWallet';
import { ethers } from 'ethers';
import { EncryptionService } from '../services/encryption';

const PREDICTION_MARKET_ADDRESS = process.env.PREDICTION_MARKET_ADDRESS!;
const MOCK_USDC_ADDRESS = process.env.MOCK_USDC_ADDRESS!;
const RPC_URL = process.env.RPC_URL || 'https://rpc.ankr.com/base_sepolia';

const PREDICTION_MARKET_ABI = [
    'function placeBet(uint256 marketId, uint8 outcome, uint256 amount) external',
    'function getMarket(uint256 marketId) external view returns (tuple(string question, uint256 endTime, bool isResolved, uint8 winningOutcome, uint256 totalYesShares, uint256 totalNoShares))'
];

const MOCK_USDC_ABI = [
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
            
            const userResult = await pool.query(
                'SELECT * FROM telegram_users WHERE telegram_id = $1',
                [telegramId]
            );
            
            if (userResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }
            
            const user = userResult.rows[0];
            const provider = new ethers.JsonRpcProvider(RPC_URL);
            
            // Decrypt private key
            const privateKey = EncryptionService.decrypt(user.encrypted_private_key);
            const wallet = new ethers.Wallet(privateKey, provider);
            
            // Convert amount to wei (USDC has 6 decimals)
            const amountInWei = ethers.parseUnits(amount.toString(), 6);
            
            // Approve USDC spending
            const usdcContract = new ethers.Contract(MOCK_USDC_ADDRESS, MOCK_USDC_ABI, wallet);
            const approveTx = await usdcContract.approve(PREDICTION_MARKET_ADDRESS, amountInWei);
            await approveTx.wait();
            
            // Place bet
            const marketContract = new ethers.Contract(PREDICTION_MARKET_ADDRESS, PREDICTION_MARKET_ABI, wallet);
            const betTx = await marketContract.placeBet(marketId, outcome, amountInWei);
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
            res.status(500).json({ success: false, message: error.message || 'Server error' });
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
            const usdcContract = new ethers.Contract(MOCK_USDC_ADDRESS, MOCK_USDC_ABI, provider);
            
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
            
            const usdcContract = new ethers.Contract(MOCK_USDC_ADDRESS, MOCK_USDC_ABI, wallet);
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
