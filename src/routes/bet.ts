import express from 'express';
import { placeBet, estimateBetCost } from '../controllers/betController';

const router = express.Router();

console.log('🎲 Bet routes module loaded!');

/**
 * @route POST /api/bet
 * @desc Place a bet on a prediction market
 * @access Public (temporarily for testing - should be Private)
 */
router.post('/', placeBet); // Removed authenticateToken for testing

/**
 * @route GET /api/bet/estimate
 * @desc Get cost estimate for a bet
 * @access Public
 */
router.get('/estimate', estimateBetCost);

export default router;
