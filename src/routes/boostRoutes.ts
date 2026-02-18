import { Router } from 'express';
import pool from '../config/database';
import { ethers } from 'ethers';
import { CONFIG } from '../config/contracts';

const router = Router();
const RPC_URL = CONFIG.RPC_URL;

// Admin wallet that receives boost payments
const ADMIN_WALLET = (process.env.ADMIN_WALLET || '0xfc8c540e7d3912458b36189f325f7f6d520be71d').toLowerCase();

// USDC contract on BSC (BEP20) - 18 decimals
const USDC_ADDRESS = (process.env.USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d').toLowerCase();

// ERC-20 transfer(address,uint256) function selector
const TRANSFER_SELECTOR = '0xa9059cbb';

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

        const tier = TIERS[tierId];

        // 1. Reject already-used TX hashes (prevent double-spending)
        const existing = await pool.query('SELECT id FROM boost_requests WHERE tx_hash = $1', [txHash]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Transaction hash already used for a boost' });
        }

        // 2. Fetch transaction from chain
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const tx = await provider.getTransaction(txHash);

        if (!tx) {
            return res.status(404).json({ success: false, message: 'Transaction not found on chain. Please wait for confirmation and try again.' });
        }

        // 3. Verify the transaction is to the USDC contract (not any other token or wallet)
        if (!tx.to || tx.to.toLowerCase() !== USDC_ADDRESS) {
            return res.status(400).json({
                success: false,
                message: `Transaction is not a USDC (BEP20) transfer. Please send USDC on BSC.`
            });
        }

        // 4. Decode the ERC-20 transfer(address recipient, uint256 amount) calldata
        const data = tx.data;
        if (!data || data.length < 10 || data.slice(0, 10).toLowerCase() !== TRANSFER_SELECTOR) {
            return res.status(400).json({
                success: false,
                message: 'Transaction is not a standard ERC-20 transfer.'
            });
        }

        // Decode: 4 bytes selector + 32 bytes address + 32 bytes amount
        const abiCoder = new ethers.AbiCoder();
        const decoded = abiCoder.decode(['address', 'uint256'], '0x' + data.slice(10));
        const recipient: string = (decoded[0] as string).toLowerCase();
        const amountRaw: bigint = decoded[1] as bigint;

        // 5. Verify recipient is exactly the admin wallet
        if (recipient !== ADMIN_WALLET) {
            return res.status(400).json({
                success: false,
                message: `Payment sent to wrong wallet. Please send to: ${ADMIN_WALLET}`
            });
        }

        // 6. Verify amount matches tier price EXACTLY (not less, not more)
        // USDC on BSC has 18 decimals
        const expectedAmount = ethers.parseUnits(tier.price.toString(), 18);
        if (amountRaw !== expectedAmount) {
            const actualFormatted = parseFloat(ethers.formatUnits(amountRaw, 18)).toFixed(2);
            return res.status(400).json({
                success: false,
                message: `Incorrect payment amount. Expected exactly $${tier.price} USDC, got $${actualFormatted} USDC.`
            });
        }

        // 7. All checks passed — record & activate boost
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

        res.json({
            success: true,
            message: `Market boosted! Active for ${tier.hours} hours.`,
            clearCache: true
        });

    } catch (error: any) {
        await pool.query('ROLLBACK').catch(() => { });
        console.error('Boost Verify Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
