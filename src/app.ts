import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { initDatabase } from './models';
import { startDepositWatcher, watchAddress, setDepositCallback } from './services/depositWatcher';
import { sendDepositNotification } from './services/whatsappNotifications';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// BET ENDPOINT - CLEAN VERSION
app.post('/api/bet', async (req, res) => {
  try {
    const { ethers } = await import('ethers');
    const { marketId, side, shares } = req.body;

    if (marketId === undefined || !side || !shares) {
      return res.status(400).json({ success: false, error: 'Missing fields: marketId, side, shares' });
    }

    const isYes = side.toUpperCase() === 'YES';

    // Use Hardhat account #0 via Mnemonic
    const mnemonic = "test test test test test test test test test test test junk";
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545', undefined, { staticNetwork: true });
    const signer = ethers.Wallet.fromPhrase(mnemonic).connect(provider);

    const MARKET_ADDR = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
    const USDC_ADDR = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

    const marketABI = [
      'function buyShares(uint256 marketId, bool isYes, uint256 shares, uint256 maxCost)',
      'function calculateCost(uint256 marketId, bool isYes, uint256 shares) view returns (uint256)',
      'function getPrice(uint256 marketId) view returns (uint256)',
    ];
    const usdcABI = ['function approve(address spender, uint256 amount) returns (bool)'];

    const usdc = new ethers.Contract(USDC_ADDR, usdcABI, signer);
    const market = new ethers.Contract(MARKET_ADDR, marketABI, signer);

    // Get nonce
    const nonce = await provider.getTransactionCount(signer.address);

    const sharesInUnits = ethers.parseUnits(shares.toString(), 6);
    const cost = await market.calculateCost(marketId, isYes, sharesInUnits);

    console.log(`Bet: ${shares} ${side} shares = ${ethers.formatUnits(cost, 6)} USDC`);

    // Approve USDC
    const approveTx = await usdc.approve(MARKET_ADDR, ethers.MaxUint256, { nonce: nonce });
    await approveTx.wait();

    // Execute bet
    const maxCost = cost + (cost * BigInt(5)) / BigInt(100);
    const tx = await market.buyShares(marketId, isYes, sharesInUnits, maxCost, { nonce: nonce + 1, gasLimit: 500000 });
    const receipt = await tx.wait();

    const newPrice = await market.getPrice(marketId);

    console.log(`Bet placed! TX: ${receipt.hash}`);

    return res.json({
      success: true,
      transaction: {
        hash: receipt.hash,
        marketId,
        side,
        shares,
        cost: ethers.formatUnits(cost, 6),
        newPrice: Number(newPrice) / 100,
      }
    });
  } catch (error: any) {
    console.error('Bet error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// WITHDRAW ENDPOINT - For custodial users
app.post('/api/withdraw', async (req, res) => {
  try {
    const { ethers } = await import('ethers');
    const { amount, address: toAddress } = req.body;

    if (!amount || !toAddress) {
      return res.status(400).json({ success: false, error: 'Missing fields: amount, address' });
    }

    // Validate address
    if (!ethers.isAddress(toAddress)) {
      return res.status(400).json({ success: false, error: 'Invalid destination address' });
    }

    // TODO: In production, verify user identity from JWT token
    // const token = req.headers.authorization?.split(' ')[1];
    // const userId = verifyToken(token).userId;
    // const userWallet = await getUserWallet(userId);

    // For demo, use Hardhat account
    const mnemonic = "test test test test test test test test test test test junk";
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545', undefined, { staticNetwork: true });
    const signer = ethers.Wallet.fromPhrase(mnemonic).connect(provider);

    const USDC_ADDR = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
    const usdcABI = ['function transfer(address to, uint256 amount) returns (bool)'];
    const usdc = new ethers.Contract(USDC_ADDR, usdcABI, signer);

    // Convert amount to USDC units (6 decimals)
    const amountInUnits = ethers.parseUnits(amount.toString(), 6);

    console.log(`Withdraw: ${amount} USDC to ${toAddress}`);

    // Execute transfer
    const tx = await usdc.transfer(toAddress, amountInUnits);
    const receipt = await tx.wait();

    console.log(`Withdrawal complete! TX: ${receipt.hash}`);

    return res.json({
      success: true,
      transaction: {
        hash: receipt.hash,
        amount,
        to: toAddress,
      }
    });
  } catch (error: any) {
    console.error('Withdraw error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET BALANCE ENDPOINT
app.get('/api/wallet/:userId/balance', async (req, res) => {
  try {
    // TODO: Fetch actual balance from user's custodial wallet
    // For demo, return mock balance
    return res.json({
      success: true,
      balance: '1000.00'
    });
  } catch (error: any) {
    console.error('Balance error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET MARKETS ENDPOINT
app.get('/api/markets', async (req, res) => {
  try {
    const { ethers } = await import('ethers');

    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545', undefined, { staticNetwork: true });
    const MARKET_ADDR = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

    const marketABI = [
      'function marketCount() view returns (uint256)',
      'function markets(uint256) view returns (string question, uint256 endTime, uint256 yesShares, uint256 noShares, uint256 liquidityParam, bool resolved, bool outcome, uint256 subsidyPool)',
      'function getPrice(uint256 marketId) view returns (uint256)',
    ];

    const market = new ethers.Contract(MARKET_ADDR, marketABI, provider);
    const count = await market.marketCount();

    const markets = [];
    for (let i = 0; i < count; i++) {
      const m = await market.markets(i);
      const price = await market.getPrice(i);
      markets.push({
        id: i,
        question: m.question,
        yesOdds: Number(price) / 100,
        noOdds: 100 - Number(price) / 100,
        volume: ethers.formatUnits(m.yesShares + m.noShares, 6),
        endTime: Number(m.endTime),
        resolved: m.resolved,
      });
    }

    return res.json({ success: true, markets });
  } catch (error: any) {
    console.error('Markets error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Health Check
app.get('/', (req, res) => {
  res.send({ status: 'OK', service: 'OPOLL Backend API' });
});

// Initialize DB and start server
initDatabase().then(async () => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Endpoints ready: POST /api/bet, POST /api/withdraw, GET /api/markets`);
  });

  // Start deposit watcher with callback
  setDepositCallback(async (userId, phoneNumber, amount, txHash) => {
    console.log(`💰 Crediting ${amount} USDC to user ${userId}`);

    // TODO: Update user balance in database
    // await updateUserBalance(userId, amount);

    // Send WhatsApp notification
    await sendDepositNotification(phoneNumber, amount, txHash);
  });

  // Start watching for deposits (use local for development)
  const wssUrl = process.env.BNB_WSS_URL || 'ws://127.0.0.1:8545';
  await startDepositWatcher(wssUrl);

}).catch(err => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});
