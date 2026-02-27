import { Router } from 'express';
import { getWallet, linkWallet, triggerCustodialDeposit, handleCustodialWithdraw, claimCustodialWinnings, executeCustodialTrade, prepareWithdrawal, submitWithdrawal } from '../controllers/walletController';

const router = Router();

router.get('/:userId', getWallet);
router.post('/link', linkWallet);
router.post('/deposit-custodial', triggerCustodialDeposit);
router.post('/custodial-withdraw', handleCustodialWithdraw); // Legacy — kept for backward compat

/**
 * Secure withdrawal — 2-step user-signed flow (custodial/Google users)
 * Step 1: POST /api/wallet/prepare-withdrawal  → returns nonce + message to sign
 * Step 2: POST /api/wallet/submit-withdrawal   → verifies signature, executes
 */
router.post('/prepare-withdrawal', prepareWithdrawal);
router.post('/submit-withdrawal', submitWithdrawal);

router.post('/claim-custodial', claimCustodialWinnings);

/**
 * @route POST /api/wallet/trade-custodial
 * @desc Execute a trade for a custodial (Google/Email) user using the backend SA.
 * Body: { privyUserId, marketId, outcomeIndex, amount }
 */
router.post('/trade-custodial', executeCustodialTrade);

export default router;
