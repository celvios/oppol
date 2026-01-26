import express from 'express';
import { updateUserBalance } from '../controllers/updateBalanceController';

const router = express.Router();

// POST /api/admin/update-balance
router.post('/update-balance', updateUserBalance);

export default router;