import { Router } from 'express';
import { generateMagicLink, registerUser } from '../controllers/authController';
import { getWallet, linkWallet, triggerCustodialDeposit, handleCustodialWithdraw } from '../controllers/walletController';
import { WhatsAppController } from '../controllers/whatsappController';
import { TelegramController } from '../controllers/telegramController';
import { placeBet, estimateBetCost } from '../controllers/betController';
import balanceRoutes from './balance';

const router = Router();

// Auth Routes (Deprecated/Removed)
// router.post('/auth/magic-link', generateMagicLink);
router.post('/register', registerUser);

// Wallet Routes
router.get('/wallet/:userId', getWallet);
router.post('/wallet/deposit-custodial', triggerCustodialDeposit);
router.post('/wallet/custodial-withdraw', handleCustodialWithdraw);
// router.post('/wallet/link', linkWallet); // Removed: Distinct auth

// Balance Routes
router.use('/balance', balanceRoutes);

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
router.get('/markets/:marketId/price-history', getMarketPriceHistory);

// Portfolio (DB-backed, no RPC calls)
router.get('/portfolio/:address', getUserPortfolio);
router.get('/portfolio/:address/stats', getUserPortfolio); // alias used by old code

import { uploadImage } from '../controllers/uploadController';
router.post('/upload', uploadImage);

router.get('/debug/contract', checkContractMarkets);

// Faucet Route
import { claimFaucet } from '../controllers/faucetController';
router.post('/faucet/claim', claimFaucet);

// Migration Route (server-side Privy signing)
import { migrateUserFunds } from '../controllers/migrateController';
router.post('/migrate', migrateUserFunds);

router.get('/health', (req, res) => {
    res.json({ status: 'API Operational' });
});

export const apiRouter = router;
