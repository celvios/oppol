import { Request, Response } from 'express';
import { query } from '../config/database';
import { EncryptionService } from '../services/encryption';
import { CustodialWalletService } from '../services/custodialWallet';
import { ethers } from 'ethers';

// Contract addresses
const MARKET_CONTRACT = process.env.MARKET_CONTRACT || '0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6';
const RPC_URL = process.env.RPC_URL || 'https://bsc-rpc.publicnode.com';

// Market contract ABI for buyShares
const MARKET_ABI = [
    'function buyShares(uint256 marketId, bool isYes, uint256 shares, uint256 maxCost)',
    'function userBalances(address) view returns (uint256)',
];

/**
 * Place a bet for a user (custodial trading)
 * POST /api/bet
 */
export const placeBet = async (req: Request, res: Response) => {
    try {
        const { walletAddress, marketId, side, shares, amount } = req.body;

        if (!walletAddress) {
            return res.status(400).json({ success: false, error: 'Wallet address required' });
        }

        if (marketId === undefined || !side) {
            return res.status(400).json({ success: false, error: 'Missing marketId or side' });
        }

        const sharesAmount = shares || 100; // Default shares if not provided

        // Look up user by wallet address
        const userResult = await query(
            'SELECT id FROM users WHERE LOWER(wallet_address) = $1',
            [walletAddress.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found. Please link wallet first.' });
        }

        const userId = userResult.rows[0].id;

        // Get user's custodial wallet
        const walletResult = await query(
            'SELECT id, public_address, encrypted_private_key, balance FROM wallets WHERE user_id = $1',
            [userId]
        );

        if (walletResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Custodial wallet not found' });
        }

        const custodialWallet = walletResult.rows[0];

        // Decrypt private key
        const privateKey = EncryptionService.decrypt(custodialWallet.encrypted_private_key);

        // Connect to blockchain
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const signer = new ethers.Wallet(privateKey, provider);
        const marketContract = new ethers.Contract(MARKET_CONTRACT, MARKET_ABI, signer);

        // Check deposited balance in contract
        const depositedBalance = await marketContract.userBalances(custodialWallet.public_address);
        const balanceFormatted = ethers.formatUnits(depositedBalance, 6);

        // Calculate cost (rough estimate: shares * price)
        const estimatedCost = amount || (sharesAmount * 0.5); // Rough estimate

        if (parseFloat(balanceFormatted) < estimatedCost) {
            return res.status(400).json({
                success: false,
                error: `Insufficient deposited balance. Have: $${balanceFormatted}, Need: ~$${estimatedCost}`
            });
        }

        // Execute trade
        const sharesInUnits = ethers.parseUnits(sharesAmount.toString(), 6);
        const maxCost = ethers.parseUnits((estimatedCost * 1.1).toString(), 6); // 10% slippage

        const tx = await marketContract.buyShares(
            marketId,
            side === 'YES',
            sharesInUnits,
            maxCost
        );

        const receipt = await tx.wait();

        return res.json({
            success: true,
            transaction: {
                hash: receipt.hash,
                cost: estimatedCost,
                shares: sharesAmount,
                side,
                marketId
            }
        });

    } catch (error: any) {
        console.error('Bet error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to place bet'
        });
    }
};

/**
 * Get bet cost estimate
 */
export const estimateBetCost = async (req: Request, res: Response) => {
    try {
        const { marketId, side, shares } = req.query;

        // For now, simple estimate based on current price
        const price = side === 'YES' ? 0.5 : 0.5; // Default 50%
        const cost = (parseFloat(shares as string) || 100) * price;

        return res.json({
            success: true,
            estimatedCost: cost.toFixed(2),
            shares,
            pricePerShare: price
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
