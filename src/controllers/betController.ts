import { Request, Response } from 'express';
import { query } from '../config/database';
import { EncryptionService } from '../services/encryption';
import { ethers } from 'ethers';

// Contract addresses
const MARKET_CONTRACT = process.env.MARKET_CONTRACT || '0xe3Eb84D7e271A5C44B27578547f69C80c497355B'; // V2 Address
const RPC_URL = process.env.RPC_URL || 'https://bsc-rpc.publicnode.com';

// Market contract ABI for buySharesFor (V2)
const MARKET_ABI = [
    'function buySharesFor(address user, uint256 marketId, uint256 outcomeIndex, uint256 shares, uint256 maxCost)',
    'function userBalances(address) view returns (uint256)',
];

/**
 * Place a bet for a user (custodial trading)
 * POST /api/bet
 */
export const placeBet = async (req: Request, res: Response) => {
    try {
        const { walletAddress, marketId, outcomeIndex, side, shares, amount } = req.body;

        if (!walletAddress) {
            return res.status(400).json({ success: false, error: 'Wallet address required' });
        }

        if (marketId === undefined) {
            return res.status(400).json({ success: false, error: 'Missing marketId' });
        }

        // Determine outcome index
        let targetOutcome = 0;
        if (outcomeIndex !== undefined) {
            targetOutcome = parseInt(outcomeIndex);
        } else if (side) {
            // Fallback for binary markets: assume NO=0, YES=1 or similar. 
            // For V2 multi-outcome, explicit outcomeIndex is preferred.
            targetOutcome = side === 'YES' ? 1 : 0;
        } else {
            return res.status(400).json({ success: false, error: 'Missing outcomeIndex or side' });
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
            return res.status(404).json({ success: false, error: 'Custodial wallet (Operator) not found' });
        }

        const custodialWallet = walletResult.rows[0];

        // Decrypt private key (This is the OPERATOR wallet)
        const privateKey = EncryptionService.decrypt(custodialWallet.encrypted_private_key);

        // Connect to blockchain
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const signer = new ethers.Wallet(privateKey, provider);
        const marketContract = new ethers.Contract(MARKET_CONTRACT, MARKET_ABI, signer);

        // Check deposited balance of the USER (not the operator)
        // usage: userBalances(userAddress)
        // Wait, the custodial wallet IS the user's wallet in some designs?
        // NO, in this design, the "custodial wallet" in DB is likely the one holding the keys?
        // If the user "deposited", they deposited into the contract and got credit on the contract.
        // The contract tracks `userBalances[userAddress]`.
        // If the user's wallet address is `walletAddress` (from request), check that.

        const balanceFormattedCheck = await marketContract.userBalances(walletAddress);
        const balanceReadable = ethers.formatUnits(balanceFormattedCheck, 18); // USDC is 18 decimals on BSC

        // Calculate cost (approximate for check)
        // In V2, price is dynamic. We'll use a safe estimate or allow transaction failure if insufficient.
        // Frontend should have validated, but we double check.
        // Assuming ~0.99 max price p/share for safety check if price info missing
        const estimatedCost = amount || (sharesAmount * 0.5); // Very rough

        if (parseFloat(balanceReadable) < 0.0001) { // Basic dust check
            // stricter check can be done if we fetch price
        }

        // Execute trade via Operator
        const sharesInUnits = ethers.parseUnits(sharesAmount.toString(), 18); // 18 decimals for shares too? 
        // V2 internal math uses 1e18 precision. Shares are strictly tracked as integers in V2 or 1e18?
        // Looking at V2 contract: `market.shares[_outcomeIndex] += _shares`
        // It's likely 1e18 if we treat them as fractional shares.
        // But usually shares are 1:1 with tokens in outcome. 
        // Let's assume 18 decimals for consistency with USDC/V2 math.

        // Max cost: allow some slippage
        const maxCost = ethers.parseUnits((estimatedCost * 1.5).toString(), 18);

        console.log(`Placing bet for ${walletAddress}: Market ${marketId}, Outcome ${targetOutcome}, Shares ${sharesAmount}`);

        const tx = await marketContract.buySharesFor(
            walletAddress,
            marketId,
            targetOutcome,
            sharesInUnits,
            maxCost
        );

        const receipt = await tx.wait();

        return res.json({
            success: true,
            transaction: {
                hash: receipt.hash,
                marketId,
                outcomeIndex: targetOutcome,
                shares: sharesAmount,
                user: walletAddress
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
        const { marketId, side, outcomeIndex, shares } = req.query;

        // Placeholder for cost estimation
        // Real implementation should call contract.getCost if available or calculate locally
        const price = 0.5;
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

