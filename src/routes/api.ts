import { Router } from 'express';
import { generateMagicLink, verifyMagicToken } from '../controllers/authController';
import { getWallet } from '../controllers/walletController';

const router = Router();

// Auth Routes (Public)
router.post('/auth/magic-link', generateMagicLink);
router.post('/auth/verify', verifyMagicToken);

// Wallet Routes (Protected - simplified for now)
// In a real app, you'd add a middleware here to verify the JWT from /auth/verify
router.get('/wallet/:userId', getWallet);

router.get('/health', (req, res) => {
    res.json({ status: 'API Operational' });
});

export const apiRouter = router;
