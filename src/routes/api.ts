import { Router } from 'express';
import { generateMagicLink, verifyMagicToken } from '../controllers/authController';
import { getWallet, linkWallet } from '../controllers/walletController';
import { WhatsAppController } from '../controllers/whatsappController';
import { TelegramController } from '../controllers/telegramController';
import { placeBet, estimateBetCost } from '../controllers/betController';
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

// WhatsApp Bot Routes
router.post('/whatsapp/user', WhatsAppController.getOrCreateUser);
router.get('/whatsapp/user', WhatsAppController.getUserByPhone);

// Telegram Bot Routes
router.post('/telegram/user', TelegramController.getOrCreateUser);
router.post('/telegram/bet', TelegramController.placeBet);
router.get('/telegram/balance/:telegramId', TelegramController.getBalance);
router.post('/telegram/withdraw', TelegramController.withdraw);

// Bet Routes
router.post('/bet', placeBet);
router.get('/bet/estimate', estimateBetCost);

// Market & Category Routes
import { createMarketMetadata, getAllMarketMetadata, getMarketMetadata, createCategory, getCategories } from '../controllers/marketController';
import { checkContractMarkets } from '../controllers/debugController';

router.post('/markets', createMarketMetadata);
// NOTE: GET /markets and GET /markets/:id are handled in app.ts with contract data

router.post('/categories', createCategory);
router.get('/categories', getCategories);

router.get('/debug/contract', checkContractMarkets);

router.get('/health', (req, res) => {
    res.json({ status: 'API Operational' });
});

export const apiRouter = router;
