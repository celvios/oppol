import { Router } from 'express';
import { getWallet, linkWallet, triggerCustodialDeposit, handleCustodialWithdraw, claimCustodialWinnings, executeCustodialTrade } from '../controllers/walletController';

const router = Router();

router.get('/:userId', getWallet);
router.post('/link', linkWallet);
router.post('/deposit-custodial', triggerCustodialDeposit);
router.post('/custodial-withdraw', handleCustodialWithdraw);
router.post('/claim-custodial', claimCustodialWinnings);

/**
 * @route POST /api/wallet/trade-custodial
 * @desc Execute a trade for a custodial (Google/Email) user using the backend SA.
 * Body: { privyUserId, marketId, outcomeIndex, amount }
 */
router.post('/trade-custodial', executeCustodialTrade);

export default router;

