import { Router } from 'express';
import { generateMagicLink, registerUser } from '../controllers/authController';
import { getWallet, linkWallet, triggerCustodialDeposit, handleCustodialWithdraw } from '../controllers/walletController';
import { WhatsAppController } from '../controllers/whatsappController';
import { TelegramController } from '../controllers/telegramController';
import { placeBet, estimateBetCost } from '../controllers/betController';
import balanceRoutes from './balance';
import { verifyAuth } from '../middleware/verifyAuth';
import { uploadImage } from '../controllers/uploadController';

const router = Router();

// Auth Routes (Deprecated/Removed)
// router.post('/auth/magic-link', generateMagicLink);
router.post('/register', registerUser);

// Wallet Routes
router.get('/wallet/:userId', getWallet);
router.post('/wallet/deposit-custodial', verifyAuth, triggerCustodialDeposit);
router.post('/wallet/custodial-withdraw', verifyAuth, handleCustodialWithdraw);
// router.post('/wallet/link', linkWallet); // Removed: Distinct auth

// Balance Routes
router.use('/balance', balanceRoutes);

// Image Upload Route (Cloudinary)
router.post('/upload', uploadImage);

// WhatsApp Bot Routes
router.post('/whatsapp/user', WhatsAppController.getOrCreateUser);
router.post('/whatsapp/bet', WhatsAppController.placeBet);
router.post('/whatsapp/withdraw', WhatsAppController.withdraw);
router.get('/whatsapp/positions/:phone', WhatsAppController.getPositions);
router.get('/whatsapp/balance/:phone', WhatsAppController.getBalance);

// Telegram Bot Routes
router.post('/telegram/user', TelegramController.getOrCreateUser);
router.post('/telegram/bet', TelegramController.placeBet);
router.get('/telegram/balance/:telegramId', TelegramController.getBalance);
router.post('/telegram/withdraw', TelegramController.withdraw);
router.get('/telegram/positions/:telegramId', TelegramController.getPositions);

// Bet Routes
router.post('/bet', placeBet);
router.get('/bet/estimate', estimateBetCost);

// Market & Category Routes
import { createMarketMetadata, getAllMarketMetadata, getMarketMetadata, createCategory, getCategories, deleteCategory, getMarketPriceHistory, getUserPortfolio } from '../controllers/marketController';
import { checkContractMarkets } from '../controllers/debugController';

router.post('/markets', createMarketMetadata);
// NOTE: GET /markets and GET /markets/:id are handled in app.ts with contract data

router.post('/categories', createCategory);
router.get('/categories', getCategories);
router.delete('/categories/:id', deleteCategory);
// Faucet Route
import { claimFaucet } from '../controllers/faucetController';
import rateLimit from 'express-rate-limit';

const faucetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2, // Limit each IP to 2 faucet requests per window
    message: { success: false, error: 'Too many requests from this IP, please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/faucet/claim', faucetLimiter, claimFaucet);

// Gas Route
import { gasRouter } from './gasRoutes';
router.use('/gas', gasRouter);

// Migration Route (server-side Privy signing)
import { migrateUserFunds } from '../controllers/migrateController';
router.post('/migrate', migrateUserFunds);

router.get('/health', (req, res) => {
    res.json({ status: 'API Operational' });
});

export const apiRouter = router;
