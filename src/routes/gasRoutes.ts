import { Router } from 'express';
import { estimateGasFeeUSDC } from '../controllers/gasController';

const router = Router();

// Endpoint to fetch the latest USDC gas fee estimation for a base UserOperation
router.get('/estimate', estimateGasFeeUSDC);

export const gasRouter = router;
