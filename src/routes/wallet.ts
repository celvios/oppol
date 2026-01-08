import express from 'express';
import { getWallet } from '../controllers/walletController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * @route GET /api/wallet/:userId
 * @desc Get wallet for user
 * @access Public (for now - should be protected)
 */
router.get('/:userId', getWallet);

export default router;
