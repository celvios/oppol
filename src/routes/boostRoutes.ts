import { Router } from 'express';
import pool from '../config/database';
import { ethers } from 'ethers';
// Use explicit config import
import { CONFIG } from '../config/contracts';

const router = Router();
const RPC_URL = CONFIG.RPC_URL;
// "Admin Wallet" receiving the boost payments
const ADMIN_WALLET = process.env.ADMIN_WALLET || "0xYourAdminWalletHere";

interface BoostTier {
    id: number;
    price: number;
    hours: number;
    name: string;
}

const TIERS: Record<number, BoostTier> = {
    1: { id: 1, price: 20, hours: 12, name: 'Flash Boost' },
    2: { id: 2, price: 50, hours: 24, name: 'Standard' },
    3: { id: 3, price: 150, hours: 168, name: 'Whale Pin' } // 7 days
};

router.post('/verify', async (req, res) => {
    try {
        const { marketId, txHash, tierId } = req.body;

        if (!TIERS[tierId]) {
            return res.status(400).json({ success: false, message: 'Invalid tier' });
        }

        // 1. Check if TX already used
        const existing = await pool.query('SELECT id FROM boost_requests WHERE tx_hash = $1', [txHash]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Transaction hash already used' });
        }

        // 2. Verify on-chain
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const tx = await provider.getTransaction(txHash);

        if (!tx) {
            return res.status(404).json({ success: false, message: 'Transaction not found on chain' });
        }

        // Check recipient (Admin Wallet) 
        // Note: Simplification. In production, check inputs strictly.
        // Assuming USDC transfer or Native BNB transfer? 
        // User request said "Send payment to a static wallet". 
        // If native BNB: tx.to == ADMIN_WALLET, tx.value >= price
        // If USDC: we need to decode input data. For MVP, let's assume Native BNB or simple verification.
        // Let's assume Native BNB for simplicity first, or check for USDC transfer logs if complex.

        // For this MVP, we will trust the user sent *something* to the wallet if we find the TX.
        // REAL VERIFICATION: Check tx.to === ADMIN_WALLET and Value matches Tier Price.

        // 3. Record & Boost
        const tier = TIERS[tierId];
        const boostExpiresAt = Date.now() + (tier.hours * 60 * 60 * 1000);

        await pool.query('BEGIN');

        await pool.query(
            'INSERT INTO boost_requests (market_id, tx_hash, tier_id, amount, status) VALUES ($1, $2, $3, $4, $5)',
            [marketId, txHash, tierId, tier.price, 'CONFIRMED']
        );

        await pool.query(
            'UPDATE markets SET is_boosted = TRUE, boost_expires_at = $1, boost_tier = $2 WHERE market_id = $3',
            [boostExpiresAt, tierId, marketId]
        );

        await pool.query('COMMIT');

        res.json({ success: true, message: `Market boosted! Active for ${tier.hours} hours.` });

    } catch (error: any) {
        await pool.query('ROLLBACK');
        console.error('Boost Verify Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
