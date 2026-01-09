import { Router } from 'express';
import { generateMagicLink, verifyMagicToken } from '../controllers/authController';
import { getWallet, linkWallet } from '../controllers/walletController';

const router = Router();

// Auth Routes (Public)
router.post('/auth/magic-link', generateMagicLink);
router.post('/auth/verify', verifyMagicToken);

// Wallet Routes
router.get('/wallet/:userId', getWallet);
router.post('/wallet/link', linkWallet);  // Link WalletConnect address to custodial wallet

router.get('/health', (req, res) => {
    res.json({ status: 'API Operational' });
});

export const apiRouter = router;
