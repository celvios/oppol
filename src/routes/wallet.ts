import express from 'express';
import { getWallet } from '../controllers/walletController';
import { authenticateToken } from '../middleware/auth';
import { triggerCustodialDeposit } from '../controllers/walletController';

const router = express.Router();

/**
 * @route GET /api/wallet/:userId
 * @desc Get wallet for user
 * @access Public (for now - should be protected)
 */
router.get('/:userId', getWallet);

/**
 * @route POST /api/wallet/deposit-custodial
 * @desc Trigger a custodial deposit for a user (sweeps USDC from custodial wallet into market contract)
 * @access Public
 */
router.post('/deposit-custodial', triggerCustodialDeposit);

export default router;
