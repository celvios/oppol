import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { initDatabase } from './models';
import { startDepositWatcher, watchAddress, setDepositCallback } from './services/depositWatcher';
import { sendDepositNotification } from './services/whatsappNotifications';
import { recordMarketPrice, getPriceHistory, startPriceTracker } from './services/priceTracker';
import { query } from './config/database';
import { validateAddress } from './utils/addressValidator';
import adminRoutes from './routes/adminRoutes';
import { apiRouter } from './routes/api';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration - allow all origins in production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? [
      'https://oppol-gamma.vercel.app',
      'https://oppol.vercel.app',
      /\.vercel\.app$/,  // Any Vercel preview deployments
      'http://localhost:3001',
      'http://localhost:3000'
    ]
    : true,  // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-secret']
};

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(corsOptions));
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Admin Routes
app.use('/api/admin', adminRoutes);

// API Routes (includes Telegram, WhatsApp, Markets, etc.)
app.use('/api', apiRouter);

// WHATSAPP USER ENDPOINT - Get or create user wallet
app.get('/api/whatsapp/user', async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number required' });
    }

    // Check if user exists
    const userResult = await query(
      'SELECT wallet_address FROM whatsapp_users WHERE phone_number = $1',
      [phone]
    );

    if (userResult.rows.length > 0) {
      return res.json({
        success: true,
        walletAddress: userResult.rows[0].wallet_address,
        isNew: false
      });
    }

    // Create new custodial wallet
    const { createRandomWallet } = await import('./services/web3');
    const { EncryptionService } = await import('./services/encryption');
    const { address, privateKey } = createRandomWallet();
    const encryptedKey = EncryptionService.encrypt(privateKey);

    await query(
      'INSERT INTO whatsapp_users (phone_number, wallet_address, encrypted_private_key) VALUES ($1, $2, $3)',
      [phone, address, encryptedKey]
    );

    console.log(`✅ Created wallet ${address} for phone ${phone}`);

    return res.json({
      success: true,
      walletAddress: address,
      isNew: true
    });
  } catch (error: any) {
    console.error('WhatsApp user error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// CALCULATE COST ENDPOINT - Preview trade cost
app.post('/api/calculate-cost', async (req, res) => {
  try {
    const { ethers } = await import('ethers');
    const { marketId, side, shares } = req.body;

    if (marketId === undefined || !side || !shares) {
      return res.status(400).json({ success: false, error: 'Missing marketId, side, or shares' });
    }

    const sharesAmount = Math.floor(shares);
    const isYes = side.toUpperCase() === 'YES';

    const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl, 97);

    const MARKET_ADDR = process.env.MARKET_ADDRESS || '0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6';
    const marketABI = [
      'function calculateCost(uint256 _marketId, bool _isYes, uint256 _shares) view returns (uint256)',
    ];

    const market = new ethers.Contract(MARKET_ADDR, marketABI, provider);
    const sharesInUnits = ethers.parseUnits(sharesAmount.toString(), 6);
    const cost = await market.calculateCost(marketId, isYes, sharesInUnits);
    const costFormatted = ethers.formatUnits(cost, 6);

    return res.json({
      success: true,
      cost: costFormatted,
      shares: sharesAmount
    });
  } catch (error: any) {
    console.error('Calculate cost error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// BET ENDPOINT - UNIFIED (Uses buySharesFor on multi-outcome contract)
// Accepts side: 'YES'/'NO' for binary markets, converts to outcomeIndex: 0/1
app.post('/api/bet', async (req, res) => {
  try {
    const { ethers } = await import('ethers');
    const { walletAddress, marketId, side, amount, outcomeIndex: explicitOutcome } = req.body;

    console.log('🔍 [BET DEBUG] Request body:', JSON.stringify(req.body, null, 2));

    if (!walletAddress) {
      return res.status(400).json({ success: false, error: 'Wallet address required' });
    }
    if (marketId === undefined || (!side && explicitOutcome === undefined) || !amount) {
      return res.status(400).json({ success: false, error: 'Missing marketId, side/outcomeIndex, or amount' });
    }

    // Validate and normalize address
    const normalizedAddress = validateAddress(walletAddress, 'Wallet address');
    console.log('🔍 [BET DEBUG] Normalized address:', normalizedAddress);

    const maxCost = parseFloat(amount);
    // Convert YES/NO to outcomeIndex (0 = Yes/First, 1 = No/Second)
    const outcomeIndex = explicitOutcome !== undefined ? explicitOutcome : (side?.toUpperCase() === 'YES' ? 0 : 1);

    // Server wallet (operator) configuration
    const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-testnet.bnbchain.org';
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return res.status(500).json({ success: false, error: 'Server wallet not configured' });
    }

    console.log('🔍 [BET DEBUG] Creating provider');
    const provider = new ethers.JsonRpcProvider(rpcUrl, 97);
    const signer = new ethers.Wallet(privateKey, provider);
    console.log('🔍 [BET DEBUG] Signer address:', signer.address);

    // Unified multi-outcome contract address
    const MARKET_ADDR = ethers.getAddress(
      process.env.MARKET_ADDRESS || process.env.MULTI_MARKET_ADDRESS || '0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6'
    );
    console.log('🔍 [BET DEBUG] Market address:', MARKET_ADDR);

    // Multi-outcome contract ABI
    const marketABI = [
      'function buySharesFor(address _user, uint256 _marketId, uint256 _outcomeIndex, uint256 _shares, uint256 _maxCost)',
      'function calculateCost(uint256 _marketId, uint256 _outcomeIndex, uint256 _shares) view returns (uint256)',
      'function userBalances(address) view returns (uint256)',
      'function getPrice(uint256 _marketId, uint256 _outcomeIndex) view returns (uint256)',
    ];

    const iface = new ethers.Interface(marketABI);

    // RAW JSON-RPC CALL FUNCTION
    async function rawCall(to: string, data: string): Promise<string> {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [{ to, data }, 'latest']
        })
      });
      const result = await response.json();
      if (result.error) {
        throw new Error(`RPC Error: ${result.error.message}`);
      }
      return result.result;
    }

    // Get user balance
    console.log('🔍 [BET DEBUG] Calling userBalances');
    const balanceData = iface.encodeFunctionData('userBalances', [normalizedAddress]);
    const balanceResult = await rawCall(MARKET_ADDR, balanceData);
    const userBalance = iface.decodeFunctionResult('userBalances', balanceResult)[0];
    const balanceFormatted = ethers.formatUnits(userBalance, 6);
    console.log(`✅ User balance: $${balanceFormatted}`);

    // Binary search to find max shares
    const maxCostInUnits = ethers.parseUnits(maxCost.toString(), 6);
    let low = 1;
    let high = Math.floor(maxCost * 2);
    let bestShares = 0;

    console.log('🔍 [BET DEBUG] Starting binary search for outcomeIndex:', outcomeIndex);
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const sharesInUnits = ethers.parseUnits(mid.toString(), 6);

      const costData = iface.encodeFunctionData('calculateCost', [marketId, outcomeIndex, sharesInUnits]);
      const costResult = await rawCall(MARKET_ADDR, costData);
      const cost = iface.decodeFunctionResult('calculateCost', costResult)[0];

      if (cost <= maxCostInUnits) {
        bestShares = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (bestShares === 0) {
      return res.status(400).json({ success: false, error: 'Amount too small to buy any shares' });
    }

    // Get final cost
    const sharesInUnits = ethers.parseUnits(bestShares.toString(), 6);
    const costData = iface.encodeFunctionData('calculateCost', [marketId, outcomeIndex, sharesInUnits]);
    const costResult = await rawCall(MARKET_ADDR, costData);
    const actualCost = iface.decodeFunctionResult('calculateCost', costResult)[0];
    const costFormatted = ethers.formatUnits(actualCost, 6);
    console.log(`✅ Cost: $${costFormatted} for ${bestShares} shares`);

    if (userBalance < actualCost) {
      return res.status(400).json({
        success: false,
        error: `Insufficient balance. Have: $${balanceFormatted}, Need: $${costFormatted}`
      });
    }

    // Execute transaction
    console.log('🔍 [BET DEBUG] Encoding transaction');
    const buyData = iface.encodeFunctionData('buySharesFor', [
      normalizedAddress,
      marketId,
      outcomeIndex,
      sharesInUnits,
      actualCost * BigInt(110) / BigInt(100)
    ]);

    console.log('🔍 [BET DEBUG] Sending transaction');
    const tx = await signer.sendTransaction({
      to: MARKET_ADDR,
      data: buyData,
      gasLimit: 500000
    });

    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error('Transaction receipt is null');
    }

    console.log(`✅ Trade executed! TX: ${receipt.hash}`);

    // Get new price
    const priceData = iface.encodeFunctionData('getPrice', [marketId, outcomeIndex]);
    const priceResult = await rawCall(MARKET_ADDR, priceData);
    const newPrice = Number(iface.decodeFunctionResult('getPrice', priceResult)[0]) / 100;

    return res.json({
      success: true,
      transaction: {
        hash: receipt.hash,
        shares: bestShares,
        cost: costFormatted,
        newPrice
      }
    });

  } catch (error: any) {
    console.error('❌ [BET ERROR]:', error.message);
    console.error('❌ [BET ERROR] Stack:', error.stack);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// MULTI-OUTCOME BET ENDPOINT - For multi-outcome markets
app.post('/api/multi-bet', async (req, res) => {
  try {
    const { ethers } = await import('ethers');
    const { walletAddress, marketId, outcomeIndex, amount } = req.body;

    console.log('🔍 [MULTI-BET DEBUG] Request body:', JSON.stringify(req.body, null, 2));

    if (!walletAddress) {
      return res.status(400).json({ success: false, error: 'Wallet address required' });
    }
    if (marketId === undefined || outcomeIndex === undefined || !amount) {
      return res.status(400).json({ success: false, error: 'Missing marketId, outcomeIndex, or amount' });
    }

    // Validate and normalize address
    const normalizedAddress = validateAddress(walletAddress, 'Wallet address');
    console.log('🔍 [MULTI-BET DEBUG] Normalized address:', normalizedAddress);

    const maxCost = parseFloat(amount);

    // Server wallet (operator) configuration
    const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-testnet.bnbchain.org';
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return res.status(500).json({ success: false, error: 'Server wallet not configured' });
    }

    console.log('🔍 [MULTI-BET DEBUG] Creating provider');
    const provider = new ethers.JsonRpcProvider(rpcUrl, 97);
    const signer = new ethers.Wallet(privateKey, provider);
    console.log('🔍 [MULTI-BET DEBUG] Signer address:', signer.address);

    // Multi-outcome contract address
    const MULTI_MARKET_ADDR = ethers.getAddress(
      process.env.MULTI_MARKET_ADDRESS || '0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6'
    );
    console.log('🔍 [MULTI-BET DEBUG] Multi-Market address:', MULTI_MARKET_ADDR);

    const marketABI = [
      'function buySharesFor(address _user, uint256 _marketId, uint256 _outcomeIndex, uint256 _shares, uint256 _maxCost)',
      'function calculateCost(uint256 _marketId, uint256 _outcomeIndex, uint256 _shares) view returns (uint256)',
      'function userBalances(address) view returns (uint256)',
      'function getPrice(uint256 _marketId, uint256 _outcomeIndex) view returns (uint256)',
    ];

    const iface = new ethers.Interface(marketABI);

    // RAW JSON-RPC CALL FUNCTION
    async function rawCall(to: string, data: string): Promise<string> {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [{ to, data }, 'latest']
        })
      });
      const result = await response.json();
      if (result.error) {
        throw new Error(`RPC Error: ${result.error.message}`);
      }
      return result.result;
    }

    // Get user balance
    console.log('🔍 [MULTI-BET DEBUG] Calling userBalances');
    const balanceData = iface.encodeFunctionData('userBalances', [normalizedAddress]);
    const balanceResult = await rawCall(MULTI_MARKET_ADDR, balanceData);
    const userBalance = iface.decodeFunctionResult('userBalances', balanceResult)[0];
    const balanceFormatted = ethers.formatUnits(userBalance, 6);
    console.log(`✅ User balance: $${balanceFormatted}`);

    // Binary search to find max shares for given cost
    const maxCostInUnits = ethers.parseUnits(maxCost.toString(), 6);
    let low = 1;
    let high = Math.floor(maxCost * 2);
    let bestShares = 0;

    console.log('🔍 [MULTI-BET DEBUG] Starting binary search');
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const sharesInUnits = ethers.parseUnits(mid.toString(), 6);

      const costData = iface.encodeFunctionData('calculateCost', [marketId, outcomeIndex, sharesInUnits]);
      const costResult = await rawCall(MULTI_MARKET_ADDR, costData);
      const cost = iface.decodeFunctionResult('calculateCost', costResult)[0];

      if (cost <= maxCostInUnits) {
        bestShares = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (bestShares === 0) {
      return res.status(400).json({ success: false, error: 'Amount too small to buy any shares' });
    }

    // Get final cost
    const sharesInUnits = ethers.parseUnits(bestShares.toString(), 6);
    const costData = iface.encodeFunctionData('calculateCost', [marketId, outcomeIndex, sharesInUnits]);
    const costResult = await rawCall(MULTI_MARKET_ADDR, costData);
    const actualCost = iface.decodeFunctionResult('calculateCost', costResult)[0];
    const costFormatted = ethers.formatUnits(actualCost, 6);
    console.log(`✅ Cost: $${costFormatted} for ${bestShares} shares`);

    if (userBalance < actualCost) {
      return res.status(400).json({
        success: false,
        error: `Insufficient balance. Have: $${balanceFormatted}, Need: $${costFormatted}`
      });
    }

    // Execute transaction
    console.log('🔍 [MULTI-BET DEBUG] Encoding transaction');
    const buyData = iface.encodeFunctionData('buySharesFor', [
      normalizedAddress,
      marketId,
      outcomeIndex,
      sharesInUnits,
      actualCost * BigInt(110) / BigInt(100) // 10% slippage
    ]);

    console.log('🔍 [MULTI-BET DEBUG] Sending transaction');
    const tx = await signer.sendTransaction({
      to: MULTI_MARKET_ADDR,
      data: buyData,
      gasLimit: 500000
    });

    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error('Transaction receipt is null');
    }

    console.log(`✅ Multi-bet executed! TX: ${receipt.hash}`);

    // Get new price
    const priceData = iface.encodeFunctionData('getPrice', [marketId, outcomeIndex]);
    const priceResult = await rawCall(MULTI_MARKET_ADDR, priceData);
    const newPrice = Number(iface.decodeFunctionResult('getPrice', priceResult)[0]) / 100;

    return res.json({
      success: true,
      transaction: {
        hash: receipt.hash,
        shares: bestShares,
        cost: costFormatted,
        newPrice
      }
    });

  } catch (error: any) {
    console.error('❌ [MULTI-BET ERROR]:', error.message);
    console.error('❌ [MULTI-BET ERROR] Stack:', error.stack);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// WALLET LINK ENDPOINT - Returns on-chain balance for connected wallet
app.post('/api/wallet/link', async (req, res) => {
  try {
    const { ethers } = await import('ethers');
    console.log(`[Wallet Link] Request received for body:`, req.body);

    // Check if body is parsed
    if (!req.body) {
      console.error('[Wallet Link] Error: req.body is undefined. Is express.json() middleware enabled?');
      return res.status(400).json({ success: false, error: 'Invalid request body' });
    }

    const { walletAddress } = req.body;

    if (!walletAddress) {
      console.error('[Wallet Link] Error: walletAddress missing in body');
      return res.status(400).json({ success: false, error: 'Wallet address required' });
    }

    // Validate address format only (no ENS resolution)
    const normalizedAddress = validateAddress(walletAddress, 'Wallet address');

    // Fetch balance from contract directly using connected wallet address
    const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl, 97);

    const MARKET_ADDR = process.env.MARKET_ADDRESS || process.env.MARKET_CONTRACT || '0x0d0279825957d13c74E6C187Cc37D502E0c3D168';
    console.log(`[Wallet Link] Using Market Address: ${MARKET_ADDR}`);
    console.log(`[Wallet Link] Using RPC: ${rpcUrl}`);

    const marketABI = ['function userBalances(address user) view returns (uint256)'];
    const market = new ethers.Contract(MARKET_ADDR, marketABI, provider);

    console.log(`[Wallet Link] Fetching balance for ${normalizedAddress}...`);
    const balanceWei = await market.userBalances(normalizedAddress);
    const balance = ethers.formatUnits(balanceWei, 6); // USDC has 6 decimals
    console.log(`[Wallet Link] Balance: ${balance}`);

    return res.json({
      success: true,
      custodialAddress: walletAddress, // Same as connected wallet
      balance: parseFloat(balance).toFixed(2)
    });

  } catch (error: any) {
    console.error('[Wallet Link] CRITICAL ERROR:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// FAUCET ENDPOINT - Mint test USDC
app.post('/api/faucet', async (req, res) => {
  try {
    const { ethers } = await import('ethers');
    const { address: toAddress } = req.body;

    if (!toAddress || !ethers.isAddress(toAddress)) {
      return res.status(400).json({ success: false, error: 'Valid address required' });
    }

    const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
    const privateKey = process.env.PRIVATE_KEY;

    if (!privateKey) {
      return res.status(500).json({ success: false, error: 'Server wallet not configured' });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl, 97);
    const signer = new ethers.Wallet(privateKey, provider);

    const USDC_ADDR = process.env.USDC_CONTRACT || '0x87D45E316f5f1f2faffCb600c97160658B799Ee0';
    const usdcABI = ['function mint(address to, uint256 amount)'];
    const usdc = new ethers.Contract(USDC_ADDR, usdcABI, signer);

    const amount = ethers.parseUnits('10000', 6);

    console.log(`Faucet: Minting 10,000 USDC to ${toAddress}`);

    const tx = await usdc.mint(toAddress, amount);
    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error('Transaction receipt is null');
    }

    console.log(`Faucet complete! TX: ${receipt.hash}`);

    return res.json({
      success: true,
      transaction: {
        hash: receipt.hash,
        amount: '10000',
        to: toAddress,
      }
    });
  } catch (error: any) {
    console.error('Faucet error:', error);
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
      return res.status(400).json({ success: false, error: 'Invalid destination address format' });
    }

    // TODO: In production, verify user identity from JWT token
    // const token = req.headers.authorization?.split(' ')[1];
    // const userId = verifyToken(token).userId;
    // const userWallet = await getUserWallet(userId);

    // Use environment variables for production
    const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
    const privateKey = process.env.PRIVATE_KEY;

    if (!privateKey) {
      return res.status(500).json({ success: false, error: 'Server wallet not configured' });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl, 97);
    const signer = new ethers.Wallet(privateKey, provider);

    const USDC_ADDR = process.env.USDC_ADDRESS || '0x87D45E316f5f1f2faffCb600c97160658B799Ee0';
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

// GET COMPREHENSIVE BALANCE ENDPOINT - Check all balance sources
app.get('/api/balance/:walletAddress', async (req, res) => {
  try {
    const { ethers } = await import('ethers');
    const { walletAddress } = req.params;

    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl, 97);

    const MARKET_ADDR = process.env.MARKET_CONTRACT || process.env.MARKET_ADDRESS || '0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6';
    const USDC_ADDR = process.env.USDC_CONTRACT || '0x87D45E316f5f1f2faffCb600c97160658B799Ee0';

    const marketABI = ['function userBalances(address) view returns (uint256)'];
    const erc20ABI = ['function balanceOf(address) view returns (uint256)'];

    const marketContract = new ethers.Contract(MARKET_ADDR, marketABI, provider);
    const usdcContract = new ethers.Contract(USDC_ADDR, erc20ABI, provider);

    const [depositedBalance, walletUsdcBalance] = await Promise.all([
      marketContract.userBalances(walletAddress),
      usdcContract.balanceOf(walletAddress)
    ]);

    const depositedFormatted = parseFloat(ethers.formatUnits(depositedBalance, 6));
    const walletUsdcFormatted = parseFloat(ethers.formatUnits(walletUsdcBalance, 6));

    return res.json({
      success: true,
      balances: {
        connectedWallet: {
          address: walletAddress,
          usdcBalance: walletUsdcFormatted
        },
        custodialWallet: {
          address: walletAddress,
          usdcBalance: walletUsdcFormatted,
          depositedInContract: depositedFormatted,
          databaseBalance: 0
        },
        totalAvailableForTrading: depositedFormatted,
        discrepancy: {
          exists: Math.abs(walletUsdcFormatted - depositedFormatted) > 0.01,
          difference: walletUsdcFormatted - depositedFormatted
        }
      }
    });
  } catch (error: any) {
    console.error('Balance check error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get balance'
    });
  }
});

app.get('/api/wallet/balance/:address', async (req, res) => {
  try {
    const { ethers } = await import('ethers');
    const { address } = req.params;

    if (!address || !ethers.isAddress(address)) {
      return res.status(400).json({ success: false, error: 'Invalid wallet address' });
    }

    // Read deposited balance from market contract
    const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl, 97);

    const MARKET_ADDR = process.env.MARKET_CONTRACT || process.env.MARKET_ADDRESS || '0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6';
    const marketABI = ['function userBalances(address user) view returns (uint256)'];
    const market = new ethers.Contract(MARKET_ADDR, marketABI, provider);

    const balanceWei = await market.userBalances(address);
    const balance = ethers.formatUnits(balanceWei, 6); // USDC has 6 decimals

    return res.json({
      success: true,
      address,
      balance,
      balanceFormatted: parseFloat(balance).toFixed(2)
    });
  } catch (error: any) {
    console.error('Balance fetch error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Legacy endpoint for backwards compatibility
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

// ADMIN CREATE MARKET ENDPOINT
app.post('/api/admin/create-market', async (req, res) => {
  try {
    const { ethers } = await import('ethers');
    const adminSecret = req.headers['x-admin-secret'];

    // Validate secret key
    const VALID_SECRET = process.env.ADMIN_SECRET || 'admin123';
    if (adminSecret !== VALID_SECRET) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { question, outcomes, category, image, description, durationHours, initialLiquidity } = req.body;

    if (!question || !outcomes || outcomes.length < 2) {
      return res.status(400).json({ success: false, error: 'Invalid market data' });
    }

    console.log(`[Admin] Creating market: "${question}" with outcomes: ${outcomes.join(', ')}`);

    // Setup Provider & Signer (Owner)
    const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-testnet.bnbchain.org'; // Default to public RPC if main failed
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) throw new Error('Server wallet not configured');

    const provider = new ethers.JsonRpcProvider(rpcUrl, 97);
    const signer = new ethers.Wallet(privateKey, provider);

    // Get Contract
    const MULTI_MARKET_ADDR = process.env.MULTI_MARKET_ADDRESS || '0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6';
    const marketABI = [
      'function createMarket(string, string[], uint256, uint256, uint256) external returns (uint256)',
      'function marketCount() view returns (uint256)'
    ];
    const contract = new ethers.Contract(MULTI_MARKET_ADDR, marketABI, signer);

    // 1. Approve Token Transfer for Subsidy/Liquidity if needed (skipped for now as liquidityParam is mostly virtual in this impl)
    // Actually, createMarket takes _subsidy. If > 0, we need to approve.
    // Assuming 0 subsidy for simplicity unless requested.

    // 2. Call createMarket
    const durationSeconds = (durationHours || 24) * 3600;
    const liquidityParam = ethers.parseUnits((initialLiquidity || 100).toString(), 6); // Default 100 B-param (normalized to token decimals if needed, assume 6 for USDC)
    // Note: In LMSR, B-param is usually roughly equal to total max possible loss. 
    // The contract uses a simple integer for B. Let's use 100 * 1e18 for precision if it parses it that way, 
    // but the contract says `uint256 constant PRECISION = 1e18;` so B should be scaled by 1e18?
    // Checking calculateCost: `(costAfter - costBefore) / PRECISION`. 
    // Wait, typical LMSR B is distinct. Looking at deployed contract logic, let's assume raw value or scaled by token decimals? 
    // The contract `_lmsrCost` divides by `b`. `(shares * PRECISION) / b`.
    // If b is small (e.g. 100), `shares * PRECISION / 100` allows large exponent. 
    // If shares are 6 decimals (USDC), `1e6 * 1e18 / 100` = `1e22`. exp(1e22) is huge.
    // Shares should probably be treated as 18 decimals internally or similar.
    // Let's stick to a safe default found in previous deployments or use a standard B-param like 500 * 1e18 (500 tokens).

    // Safest bet: 100 * 1e18 (Standard for 18 decimal tokens).
    const liquidityB = BigInt(initialLiquidity || 1000) * BigInt(1e18);

    const tx = await contract.createMarket(
      question,
      outcomes,
      durationSeconds,
      liquidityB,
      0 // Subsidy 0 for now
    );

    console.log(`[Admin] TX Sent: ${tx.hash}`);
    await tx.wait();

    // 3. Get the new Market ID
    // Since we can't easily parse logs here without complex code, we can read marketCount - 1
    // OR just fetch the latest market count.
    const count = await contract.marketCount();
    const newMarketId = Number(count) - 1;

    console.log(`[Admin] Market Created. ID: ${newMarketId}`);

    // 4. Save Metadata to DB
    await query(
      `INSERT INTO markets (market_id, question, description, image, category, outcome_names)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (market_id) DO UPDATE 
       SET question = $2, description = $3, image = $4, category = $5, outcome_names = $6`,
      [newMarketId, question, description, image, category, JSON.stringify(outcomes)]
    );

    return res.json({ success: true, marketId: newMarketId, txHash: tx.hash });

  } catch (error: any) {
    console.error('Create market error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET MARKETS ENDPOINT
app.get('/api/markets', async (req, res) => {
  try {
    const { ethers } = await import('ethers');

    const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl, 97);
    const MARKET_ADDR = process.env.MARKET_CONTRACT || process.env.MARKET_ADDRESS || '0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6';

    const marketABI = [
      'function marketCount() view returns (uint256)',
      'function getMarketBasicInfo(uint256) view returns (string question, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)'
    ];

    const marketContract = new ethers.Contract(MARKET_ADDR, marketABI, provider);

    console.log('[Markets API] Using contract:', MARKET_ADDR);
    console.log('[Markets API] Using RPC:', rpcUrl);

    const count = await marketContract.marketCount();
    console.log('[Markets API] Market count:', count.toString());

    // Get market metadata from database
    let metadataMap: Record<number, any> = {};
    try {
      const metadataResult = await query('SELECT * FROM markets');
      metadataResult.rows.forEach((row: any) => {
        metadataMap[row.market_id] = row;
      });
    } catch (e) {
      console.log('Database not available for metadata, using defaults');
    }

    // Get volume from database
    let volumeByMarket: Record<number, number> = {};
    try {
      const volumeResult = await query(
        `SELECT market_id, SUM(total_cost) as volume FROM trades GROUP BY market_id`
      );
      volumeResult.rows.forEach((row: any) => {
        volumeByMarket[row.market_id] = parseFloat(row.volume);
      });
    } catch (e) {
      console.log('Database not available for volume calculation');
    }

    const markets = [];
    console.log(`[Markets API] Fetching ${Number(count)} markets...`);

    for (let i = 0; i < Number(count); i++) {
      try {
        console.log(`[Markets API] Fetching market ${i}...`);
        const m = await marketContract.getMarketBasicInfo(i);
        console.log(`[Markets API] Market ${i} question: ${m.question}`);
        const metadata = metadataMap[i] || {};

        markets.push({
          market_id: i,
          question: m.question,
          description: metadata.description || '',
          image_url: metadata.image || '',
          category_id: metadata.category || ''
        });
      } catch (err: any) {
        console.error(`[Markets API] Error fetching market ${i}:`, err.message || err);
      }
    }

    console.log(`[Markets API] Returning ${markets.length} markets`);

    return res.json({ success: true, markets });
  } catch (error: any) {
    console.error('Markets error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to fetch markets' });
  }
});

// GET SINGLE MARKET ENDPOINT - Fetch from contract
app.get('/api/markets/:id', async (req, res) => {
  try {
    const { ethers } = await import('ethers');
    const marketId = parseInt(req.params.id);

    if (isNaN(marketId) || marketId < 0) {
      return res.status(400).json({ success: false, message: 'Invalid market ID' });
    }

    const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl, 97);
    const MARKET_ADDR = process.env.MARKET_CONTRACT || process.env.MARKET_ADDRESS || '0xB6a211822649a61163b94cf46e6fCE46119D3E1b';

    const marketABI = [
      'function marketCount() view returns (uint256)',
      'function getMarketBasicInfo(uint256) view returns (string question, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)',
      'function getMarketOutcomes(uint256) view returns (string[])',
      'function getAllPrices(uint256) view returns (uint256[])'
    ];

    const marketContract = new ethers.Contract(MARKET_ADDR, marketABI, provider);

    // Verify market exists
    const count = await marketContract.marketCount();
    if (marketId >= Number(count)) {
      return res.status(404).json({ success: false, message: 'Market not found' });
    }

    const [basicInfo, outcomes, prices] = await Promise.all([
      marketContract.getMarketBasicInfo(marketId),
      marketContract.getMarketOutcomes(marketId),
      marketContract.getAllPrices(marketId)
    ]);

    // Get metadata from database if available
    let metadata: any = {};
    try {
      const metadataResult = await query('SELECT * FROM markets WHERE market_id = $1', [marketId]);
      if (metadataResult.rows.length > 0) {
        metadata = metadataResult.rows[0];
      }
    } catch (e) {
      // Database not available, use defaults
    }

    const market = {
      market_id: marketId,
      question: basicInfo.question,
      description: metadata.description || '',
      image_url: metadata.image || '',
      category_id: metadata.category || '',
      outcomes: outcomes,
      prices: prices.map((p: bigint) => Number(p) / 100), // Convert to percentage
      outcomeCount: Number(basicInfo.outcomeCount),
      endTime: Number(basicInfo.endTime),
      liquidityParam: ethers.formatUnits(basicInfo.liquidityParam, 18),
      resolved: basicInfo.resolved,
      winningOutcome: Number(basicInfo.winningOutcome)
    };

    return res.json({ success: true, market });
  } catch (error: any) {
    console.error('Single market error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to fetch market' });
  }
});

// ADMIN STATS ENDPOINT
app.get('/api/admin/stats', async (req, res) => {
  try {
    const { ethers } = await import('ethers');
    const adminSecret = req.headers['x-admin-secret'];

    // Validate secret key
    const VALID_SECRET = process.env.ADMIN_SECRET || 'admin123';
    if (adminSecret !== VALID_SECRET) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // 1. Get User Count (Total + New Today)
    const userResult = await query('SELECT COUNT(*) as count FROM users');
    const totalUsers = parseInt(userResult.rows[0]?.count || '0');

    // New users today (mock DB doesn't track created_at well, so fallback to 0)
    let newUsersToday = 0;
    try {
      const todayResult = await query(
        `SELECT COUNT(*) as count FROM users WHERE created_at >= CURRENT_DATE`
      );
      newUsersToday = parseInt(todayResult.rows[0]?.count || '0');
    } catch { newUsersToday = 0; }

    // 2. Get Volume (Current + Last Week for Trend)
    let totalVolume = 0;
    let volumeTrend = 'N/A';
    try {
      const volumeResult = await query('SELECT SUM(total_cost) as volume FROM trades');
      totalVolume = parseFloat(volumeResult.rows[0]?.volume || '0');

      // Last week's volume
      const lastWeekResult = await query(
        `SELECT SUM(total_cost) as volume FROM trades WHERE created_at < CURRENT_DATE - INTERVAL '7 days'`
      );
      const lastWeekVolume = parseFloat(lastWeekResult.rows[0]?.volume || '0');

      if (lastWeekVolume > 0) {
        const change = ((totalVolume - lastWeekVolume) / lastWeekVolume) * 100;
        volumeTrend = `${change >= 0 ? '+' : ''}${change.toFixed(0)}% this week`;
      } else {
        volumeTrend = totalVolume > 0 ? 'New activity' : 'No trades yet';
      }
    } catch { volumeTrend = 'N/A'; }

    // 3. Get Active Markets (from contract) + Expiring Soon
    const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl, 97);
    const MARKET_ADDR = process.env.MARKET_CONTRACT || process.env.MARKET_ADDRESS || '0xB6a211822649a61163b94cf46e6fCE46119D3E1b';

    const marketABI = [
      'function marketCount() view returns (uint256)',
      'function getMarketBasicInfo(uint256 marketId) view returns (string question, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)'
    ];
    const marketContract = new ethers.Contract(MARKET_ADDR, marketABI, provider);
    const marketCount = Number(await marketContract.marketCount());
    console.log(`[Admin Stats] marketCount from contract: ${marketCount}`);

    // Count expiring markets (ending in next 48 hours)
    let expiringMarkets = 0;
    let activeMarkets = marketCount; // Default to total count
    const now = Math.floor(Date.now() / 1000);
    const expiringThreshold = now + (48 * 60 * 60); // 48 hours from now

    // Try to get detailed info for expiring count (but don't fail if it errors)
    try {
      let activeCount = 0;
      for (let i = 0; i < marketCount; i++) {
        try {
          const info = await marketContract.getMarketBasicInfo(i);
          const endTime = Number(info[2]);
          const resolved = info[4];
          if (!resolved && endTime > now) {
            activeCount++;
            if (endTime <= expiringThreshold) {
              expiringMarkets++;
            }
          }
        } catch (e: any) {
          console.log(`[Admin Stats] Market ${i} info failed: ${e.message?.slice(0, 50)}`);
          // Still count it as active if we can't get details
          activeCount++;
        }
      }
      activeMarkets = activeCount;
    } catch (e) {
      console.log('[Admin Stats] Detailed market scan failed, using marketCount');
      activeMarkets = marketCount;
    }

    // 4. Calculate Total Liquidity
    const USDC_ADDR = process.env.USDC_CONTRACT || '0x16E4A3d9697D47c61De3bDD1DdDa4148aA09D634';
    const erc20ABI = ['function balanceOf(address) view returns (uint256)'];
    const usdcContract = new ethers.Contract(USDC_ADDR, erc20ABI, provider);
    const contractBalanceWei = await usdcContract.balanceOf(MARKET_ADDR);
    const totalLiquidity = parseFloat(ethers.formatUnits(contractBalanceWei, 6));

    // Liquidity Trend (simple: if > 0, stable; else new)
    const liquidityTrend = totalLiquidity > 0 ? 'Stable' : 'Awaiting deposits';

    return res.json({
      success: true,
      stats: {
        totalLiquidity: `$${totalLiquidity.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        totalVolume: `$${totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        activeMarkets,
        totalUsers,
        // Trend data
        volumeTrend,
        liquidityTrend,
        expiringMarkets,
        newUsersToday
      }
    });
  } catch (error: any) {
    console.error('Admin stats error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// SAVE MARKET METADATA ENDPOINT
app.post('/api/markets/metadata', async (req, res) => {
  try {
    const { marketId, question, description, image, category } = req.body;

    if (marketId === undefined || !question) {
      return res.status(400).json({ success: false, error: 'Missing marketId or question' });
    }

    await query(
      `INSERT INTO markets (market_id, question, description, image, category)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (market_id) DO UPDATE 
       SET question = $2, description = $3, image = $4, category = $5`,
      [marketId, question, description, image, category]
    );

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Save metadata error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// CONTRACT DIAGNOSTICS ENDPOINT
app.get('/api/contract/check', async (req, res) => {
  try {
    const { ethers } = await import('ethers');

    const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl, 97);
    const MARKET_ADDR = process.env.MARKET_CONTRACT || process.env.MARKET_ADDRESS || '0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6';

    // Get contract code
    const code = await provider.getCode(MARKET_ADDR);

    // Check if buySharesFor function exists
    const buySharesForSelector = ethers.id('buySharesFor(address,uint256,bool,uint256,uint256)').slice(0, 10);
    const hasBuySharesFor = code.includes(buySharesForSelector.slice(2));

    // Get server wallet address
    const privateKey = process.env.PRIVATE_KEY;
    let serverWallet = 'Not configured';
    if (privateKey) {
      const wallet = new ethers.Wallet(privateKey);
      serverWallet = wallet.address;
    }

    return res.json({
      success: true,
      contract: {
        address: MARKET_ADDR,
        hasCode: code !== '0x',
        hasBuySharesFor,
        buySharesForSelector
      },
      serverWallet,
      rpcUrl
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET USER PORTFOLIO ENDPOINT
app.get('/api/portfolio/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress) {
      return res.status(400).json({ success: false, error: 'Wallet address required' });
    }

    try {
      // Get user's trades from database
      const tradesResult = await query(
        `SELECT market_id, side, SUM(shares) as total_shares, 
                AVG(price_per_share) as avg_price, SUM(total_cost) as total_cost
         FROM trades 
         WHERE LOWER(user_address) = $1 
         GROUP BY market_id, side
         ORDER BY market_id, side`,
        [walletAddress.toLowerCase()]
      );

      const positions = tradesResult.rows.map((row: any) => ({
        marketId: row.market_id,
        side: row.side,
        shares: parseFloat(row.total_shares),
        avgPrice: parseFloat(row.avg_price),
        totalCost: parseFloat(row.total_cost)
      }));

      return res.json({
        success: true,
        positions,
        totalPositions: positions.length
      });
    } catch (dbError) {
      // Database not available, return empty portfolio
      return res.json({
        success: true,
        positions: [],
        totalPositions: 0,
        note: 'Database unavailable - positions not tracked'
      });
    }
  } catch (error: any) {
    console.error('Portfolio error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PRICE HISTORY ENDPOINT - For charts
app.get('/api/markets/:id/price-history', async (req, res) => {
  try {
    const marketId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 50;

    if (isNaN(marketId)) {
      return res.status(400).json({ success: false, error: 'Invalid market ID' });
    }

    const history = await getPriceHistory(marketId, limit);

    return res.json({ success: true, history });
  } catch (error: any) {
    console.error('Price history error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PORTFOLIO STATS ENDPOINT - For PnL
app.get('/api/portfolio/:address/stats', async (req, res) => {
  try {
    const { address } = req.params;
    const { query } = await import('./config/database');

    // Get weighted average entry price for each market and side
    // Formula: Sum(Cost) / Sum(Shares)
    // We filter by user address (case insensitive)
    const result = await query(
      `SELECT 
            market_id, 
            side, 
            SUM(total_cost) as total_cost, 
            SUM(shares) as total_shares,
            SUM(total_cost) / NULLIF(SUM(shares), 0) as avg_price
         FROM trades 
         WHERE LOWER(user_address) = LOWER($1) OR LOWER(user_address) = 'external_wallet'
         GROUP BY market_id, side`,
      [address]
    );

    const stats: Record<string, any> = {};

    result.rows.forEach((row: any) => {
      const key = `${row.market_id}-${row.side}`;
      stats[key] = {
        marketId: row.market_id,
        side: row.side,
        avgPrice: parseFloat(row.avg_price),
        totalCost: parseFloat(row.total_cost),
        totalShares: parseFloat(row.total_shares)
      };
    });

    return res.json({ success: true, stats });
  } catch (error: any) {
    console.error('Portfolio stats error:', error);
    return res.json({ success: false, stats: {} }); // Fallback to empty on error
  }
});

// DATABASE MIGRATION ENDPOINT
app.post('/api/admin/migrate', async (req, res) => {
  try {
    const { query } = await import('./config/database');

    // Admin auth check (simple secret for now)
    const adminSecret = req.headers['x-admin-secret'];
    if (adminSecret !== process.env.ADMIN_SECRET && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const migrationQueries = `
      -- Enable UUID extension
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      -- Users Table
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        phone_number VARCHAR(50) UNIQUE NOT NULL,
        wallet_address VARCHAR(42),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Wallets Table (for custodial users)
      CREATE TABLE IF NOT EXISTS wallets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        public_address VARCHAR(42) NOT NULL,
        encrypted_private_key TEXT NOT NULL,
        balance DECIMAL(18, 6) DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Auth Tokens Table (Magic Links)
      CREATE TABLE IF NOT EXISTS auth_tokens (
        token VARCHAR(255) PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used BOOLEAN DEFAULT FALSE
      );

      -- User Positions Table (Track bets)
      CREATE TABLE IF NOT EXISTS positions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        market_id INTEGER NOT NULL,
        side VARCHAR(3) NOT NULL CHECK (side IN ('YES', 'NO')),
        shares DECIMAL(18, 6) NOT NULL,
        cost_basis DECIMAL(18, 6) NOT NULL,
        tx_hash VARCHAR(66),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Trades Table (Granular trade history for PnL)
      CREATE TABLE IF NOT EXISTS trades (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        market_id INTEGER NOT NULL,
        user_address VARCHAR(42) NOT NULL,
        side VARCHAR(3) NOT NULL CHECK (side IN ('YES', 'NO')),
        shares DECIMAL(18, 6) NOT NULL,
        price_per_share DECIMAL(18, 6) NOT NULL,
        total_cost DECIMAL(18, 6) NOT NULL,
        tx_hash VARCHAR(66),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Transactions Table (Deposits, Withdrawals, Bets)
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAW', 'BET', 'CLAIM')),
        amount DECIMAL(18, 6) NOT NULL,
        tx_hash VARCHAR(66),
        status VARCHAR(20) DEFAULT 'PENDING',
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Price History Table (for charts)
      CREATE TABLE IF NOT EXISTS price_history (
        id SERIAL PRIMARY KEY,
        market_id INTEGER NOT NULL,
        price INTEGER NOT NULL,
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_positions_user_id ON positions(user_id);
      CREATE INDEX IF NOT EXISTS idx_positions_market_id ON positions(market_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
      CREATE INDEX IF NOT EXISTS idx_price_history_market_id ON price_history(market_id);
      CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON price_history(recorded_at);
    `;

    await query(migrationQueries);

    console.log('✅ Database migration completed');
    res.json({
      success: true,
      message: 'Database migration completed successfully',
      tables: ['users', 'wallets', 'auth_tokens', 'positions', 'transactions']
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DATABASE STATUS ENDPOINT
app.get('/api/admin/db-status', async (req, res) => {
  try {
    const { query } = await import('./config/database');

    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    res.json({
      success: true,
      connected: true,
      tables: tablesResult.rows.map((r: any) => r.table_name)
    });
  } catch (error: any) {
    res.json({
      success: false,
      connected: false,
      error: error.message
    });
  }
});

// Health Check
app.get('/', (req, res) => {
  res.send({
    status: 'OK',
    service: 'OPOLL Backend API',
    environment: process.env.NODE_ENV || 'development',
    database: process.env.DATABASE_URL ? 'PostgreSQL' : 'In-Memory Mock'
  });
});

// Initialize DB and start server
initDatabase().then(async () => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Endpoints ready: POST /api/bet, POST /api/withdraw, GET /api/markets, POST /api/admin/migrate`);
  });

  // Start deposit watcher ONLY if valid WebSocket URL is provided
  const wssUrl = process.env.BNB_WSS_URL;

  if (wssUrl && !wssUrl.includes('127.0.0.1') && !wssUrl.includes('localhost')) {
    // Set callback for deposit notifications
    setDepositCallback(async (userId, phoneNumber, amount, txHash) => {
      console.log(`💰 Crediting ${amount} USDC to user ${userId}`);
      // TODO: Update user balance in database
      await sendDepositNotification(phoneNumber, amount, txHash);
    });

    try {
      await startDepositWatcher(wssUrl);
    } catch (error) {
      console.warn('⚠️ Deposit watcher failed to start (non-fatal):', error);
    }
  } else {
    console.log('ℹ️ Deposit watcher disabled (no valid BNB_WSS_URL configured)');
    console.log('   Set BNB_WSS_URL to enable real-time deposit monitoring');
  }

  // Start price tracker for chart history (every 5 minutes)
  if (process.env.DATABASE_URL) {
    startPriceTracker(5 * 60 * 1000);
  } else {
    console.log('ℹ️ Price tracker disabled (no DATABASE_URL configured)');
  }

}).catch(err => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});