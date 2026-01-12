import { Router } from 'express';
import { generateMagicLink, verifyMagicToken } from '../controllers/authController';
import { getWallet, linkWallet } from '../controllers/walletController';
import balanceRoutes from './balance';

const router = Router();

// Auth Routes (Deprecated/Removed)
// router.post('/auth/magic-link', generateMagicLink);
// router.post('/auth/verify', verifyMagicToken);

// Wallet Routes
router.get('/wallet/:userId', getWallet);
// router.post('/wallet/link', linkWallet); // Removed: Distinct auth

// Balance Routes
router.use('/balance', balanceRoutes);

// Market & Category Routes
import { createMarketMetadata, getAllMarketMetadata, getMarketMetadata, createCategory, getCategories } from '../controllers/marketController';

router.post('/markets', createMarketMetadata);
router.get('/markets', getAllMarketMetadata);
router.get('/markets/:marketId', getMarketMetadata);

router.post('/categories', createCategory);
router.get('/categories', getCategories);

router.get('/health', (req, res) => {
    res.json({ status: 'API Operational' });
});

export const apiRouter = router;
