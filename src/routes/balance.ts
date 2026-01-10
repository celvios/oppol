import { Router } from 'express';
import { getBalance } from '../controllers/balanceController';

const router = Router();

// Get comprehensive balance info
router.get('/:walletAddress', getBalance);

export default router;