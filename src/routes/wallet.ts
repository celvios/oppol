import { Router } from 'express';
import { getWallet, linkWallet, triggerCustodialDeposit, handleCustodialWithdraw } from '../controllers/walletController';

const router = Router();

/**
 * @route GET /api/wallet/:userId
 * @desc Get wallet for user
 * @access Public (for now - should be protected)
 */
router.get('/:userId', getWallet);

/**
 * @route POST /api/wallet/link
 * @desc Link external wallet (Deprecated)
 */
router.post('/link', linkWallet);

/**
 * @route POST /api/wallet/deposit-custodial
 * @desc Trigger a custodial deposit for a user (sweeps USDC from custodial wallet into market contract)
 * @access Public
 */
router.post('/deposit-custodial', triggerCustodialDeposit);

/**
 * @route POST /api/wallet/custodial-withdraw
 * @desc Trigger a custodial withdrawal (Market -> Wallet -> External)
 * @access Public
 */
router.post('/custodial-withdraw', handleCustodialWithdraw);

export default router;
