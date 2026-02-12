import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { Server } from 'socket.io';
import { initDatabase } from './models';
import { startDepositWatcher, watchAddress, setDepositCallback } from './services/depositWatcher';
import { sendDepositNotification } from './services/whatsappNotifications';
import { recordMarketPrice, getPriceHistory, startPriceTracker } from './services/priceTracker';
import { query } from './config/database';
import { CONFIG } from './config/contracts';
import { validateAddress } from './utils/addressValidator';
import adminRoutes from './routes/adminRoutes';
import updateBalanceRoutes from './routes/admin';
import commentsRoutes from './routes/comments';
import boostRoutes from './routes/boostRoutes';
import { apiRouter } from './routes/api';

const app = express();
const PORT = process.env.PORT || 3001;

// Create HTTP server for Socket.IO
const server = http.createServer(app);

// CORS configuration - allow Vercel frontends and localhost
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Allowed origins list
    const allowedOrigins = [
      'https://oppolbnb.vercel.app',
      'https://oppol-gamma.vercel.app',
      'https://oppol.vercel.app',
      'https://www.opoll.org',
      'https://opoll.org',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002'
    ];

    // Check if origin is in allowed list or matches vercel.app pattern
    const isAllowed = allowedOrigins.includes(origin) ||
      /^https:\/\/.*\.vercel\.app$/.test(origin) ||
      /^https:\/\/.*\.opoll\.org$/.test(origin);

    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-secret', 'X-Requested-With']
};

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Increased limit for base64 image uploads

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Admin Routes
app.use('/api/admin', adminRoutes);
app.use('/api/admin', updateBalanceRoutes);

// API Routes (includes Telegram, WhatsApp, Markets, etc.)
// API Routes (includes Telegram, WhatsApp, Markets, etc.)
app.use('/api/comments', commentsRoutes);
app.use('/api/boost', boostRoutes);
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

    const rpcUrl = CONFIG.RPC_URL;
    const provider = new ethers.JsonRpcProvider(rpcUrl, parseInt(process.env.CHAIN_ID || '56'));

    const MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MARKET_ADDRESS || process.env.MARKET_CONTRACT;
    if (!MARKET_ADDR) throw new Error("Missing MARKET_ADDRESS env var");
    const marketABI = [
      'function calculateCost(uint256 _marketId, bool _isYes, uint256 _shares) view returns (uint256)',
    ];

    const market = new ethers.Contract(MARKET_ADDR, marketABI, provider);
    const sharesInUnits = ethers.parseUnits(sharesAmount.toString(), 18); // Shares are 18 decimals
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
    const rpcUrl = CONFIG.RPC_URL;
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return res.status(500).json({ success: false, error: 'Server wallet not configured' });
    }

    console.log('🔍 [BET DEBUG] Creating provider');
    const provider = new ethers.JsonRpcProvider(rpcUrl, parseInt(process.env.CHAIN_ID || '56'));
    const signer = new ethers.Wallet(privateKey, provider);
    console.log('🔍 [BET DEBUG] Signer address:', signer.address);

    // Unified multi-outcome contract address
    const MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MARKET_ADDRESS || process.env.MULTI_MARKET_ADDRESS;
    if (!MARKET_ADDR) throw new Error("Missing MARKET_ADDRESS env var");
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
      const sharesInUnits = ethers.parseUnits(mid.toString(), 18); // Shares are 18 decimals

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
    const sharesInUnits = ethers.parseUnits(bestShares.toString(), 18); // Shares are 18 decimals
    const costData = iface.encodeFunctionData('calculateCost', [marketId, outcomeIndex, sharesInUnits]);
    const costResult = await rawCall(MARKET_ADDR, costData);
    const actualCost = iface.decodeFunctionResult('calculateCost', costResult)[0];
    const costFormatted = ethers.formatUnits(actualCost, 6);
    const sharesFormatted = ethers.formatUnits(bestShares, 18);
    console.log(`✅ Cost: $${costFormatted} for ${sharesFormatted} shares`);
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
        shares: ethers.formatUnits(bestShares, 18), // Format from wei to decimal
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
    const rpcUrl = CONFIG.RPC_URL;
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return res.status(500).json({ success: false, error: 'Server wallet not configured' });
    }

    // CRITICAL: Validate RPC URL to prevent network mismatch
    if (!rpcUrl) {
      console.error('❌ [MULTI-BET ERROR] RPC_URL is not configured!');
      return res.status(500).json({ success: false, error: 'RPC URL not configured. Check BNB_RPC_URL environment variable.' });
    }

    const expectedChainId = parseInt(process.env.CHAIN_ID || '56');
    console.log('🔍 [MULTI-BET DEBUG] Creating provider');
    console.log('🔍 [MULTI-BET DEBUG] RPC URL:', rpcUrl);
    console.log('🔍 [MULTI-BET DEBUG] Expected Chain ID:', expectedChainId);

    const provider = new ethers.JsonRpcProvider(rpcUrl, expectedChainId);

    // Verify we're connected to the correct network
    const network = await provider.getNetwork();
    console.log('🔍 [MULTI-BET DEBUG] Connected to Chain ID:', network.chainId.toString());

    if (network.chainId !== BigInt(expectedChainId)) {
      console.error(`❌ [MULTI-BET ERROR] Network mismatch! Expected ${expectedChainId}, got ${network.chainId}`);
      return res.status(500).json({
        success: false,
        error: `Network mismatch: Connected to chain ${network.chainId}, expected ${expectedChainId}. Check your RPC_URL configuration.`
      });
    }

    const signer = new ethers.Wallet(privateKey, provider);
    console.log('🔍 [MULTI-BET DEBUG] Signer address:', signer.address);

    // Multi-outcome contract address
    const MULTI_MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MULTI_MARKET_ADDRESS;
    if (!MULTI_MARKET_ADDR) throw new Error("Missing MARKET_ADDRESS env var");
    console.log('🔍 [MULTI-BET DEBUG] Multi-Market address:', MULTI_MARKET_ADDR);

    const marketABI = [
      'function buySharesFor(address _user, uint256 _marketId, uint256 _outcomeIndex, uint256 _shares, uint256 _maxCost)',
      'function calculateCost(uint256 _marketId, uint256 _outcomeIndex, uint256 _shares) view returns (uint256)',
      'function userBalances(address) view returns (uint256)',
      'function getPrice(uint256 _marketId, uint256 _outcomeIndex) view returns (uint256)',
    ];

    const iface = new ethers.Interface(marketABI);

    // RAW JSON-RPC CALL FUNCTION with rate limiting
    let lastCallTime = 0;
    async function rawCall(to: string, data: string): Promise<string> {
      // Rate limiting: ensure at least 25ms between calls (max 40 req/sec, safely under 50 limit)
      const now = Date.now();
      const timeSinceLastCall = now - lastCallTime;
      if (timeSinceLastCall < 25) {
        await new Promise(resolve => setTimeout(resolve, 25 - timeSinceLastCall));
      }
      lastCallTime = Date.now();

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
    console.log('🔍 [MULTI-BET DEBUG] Raw balance:', userBalance.toString());
    // FIX: Contract stores balances in 18 decimals, not 6!
    const balanceFormatted = ethers.formatUnits(userBalance, 18);
    console.log(`✅ User balance: $${balanceFormatted}`);

    // Binary search to find max shares (in wei) for given cost
    const maxCostInUnits = ethers.parseUnits(maxCost.toString(), 6);

    // DEDUCT FEE: Contract adds 5% fee ON TOP of cost.
    // So Total = Cost * 1.05
    // We need Cost <= UserAmount / 1.05
    const FEE_BPS = BigInt(500); // 5%
    const BPS_DIVISOR = BigInt(10000);
    const effectiveMaxCost = BigInt(maxCostInUnits) * BPS_DIVISOR / (BPS_DIVISOR + FEE_BPS);

    let low = BigInt(1);
    // Rough estimate: 1 USDC (1e6) ~= 1 Share (1e18) if price is 1.0
    // So if price is 0.01, 1 USDC ~= 100 Shares
    const conversionFactor = BigInt(10) ** BigInt(12);
    let high = BigInt(maxCostInUnits) * conversionFactor * BigInt(100);

    let bestShares = BigInt(0);


    console.log('🔍 [MULTI-BET DEBUG] Starting binary search (fractional)');
    console.log('🔍 [MULTI-BET DEBUG] maxCost:', maxCost, 'maxCostInUnits:', maxCostInUnits.toString());
    console.log('🔍 [MULTI-BET DEBUG] effectiveMaxCost after fee:', effectiveMaxCost.toString(), 'formatted:', ethers.formatUnits(effectiveMaxCost, 6));
    console.log('🔍 [MULTI-BET DEBUG] Search range: low=', low.toString(), 'high=', high.toString());

    // Limit iterations to prevent timeouts (log2(high) ~ 60-70 iterations max usually)
    let iterations = 0;
    let lastCheckedCost = BigInt(0);
    while (low <= high && iterations < 100) {
      const mid = (low + high) / BigInt(2);
      // mid is already in 18 decimals (wei)

      const costData = iface.encodeFunctionData('calculateCost', [marketId, outcomeIndex, mid]);
      const costResult = await rawCall(MULTI_MARKET_ADDR, costData);
      const rawCost = BigInt(iface.decodeFunctionResult('calculateCost', costResult)[0]);

      // CRITICAL FIX: Contract scales by 1e12 internally (liquidityParam * 1e12), so divide by 1e12 to get USDC units (6 decimals)
      const cost = rawCost / BigInt(1e12);
      lastCheckedCost = cost;

      // Log first 5 and last 5 iterations
      if (iterations < 5 || iterations > 68) {
        console.log(`🔍 [ITER ${iterations}] shares=${ethers.formatUnits(mid, 18)}, rawCost=${rawCost.toString()}, cost=${ethers.formatUnits(cost, 6)} USDC, effectiveMax=${ethers.formatUnits(effectiveMaxCost, 6)}`);
      }

      if (cost <= effectiveMaxCost) {
        bestShares = mid;
        low = mid + BigInt(1);
      } else {
        high = mid - BigInt(1);
      }
      iterations++;
    }

    console.log('🔍 [MULTI-BET DEBUG] Binary search complete. Iterations:', iterations, 'bestShares:', bestShares.toString());

    if (bestShares === BigInt(0)) {
      console.error('❌ [MULTI-BET ERROR] No shares found! maxCost:', maxCost, 'effectiveMaxCost:', ethers.formatUnits(effectiveMaxCost, 6));
      console.error('❌ [MULTI-BET ERROR] Last checked cost:', ethers.formatUnits(lastCheckedCost, 6), 'USDC');
      return res.status(400).json({ success: false, error: 'Amount too small to buy any shares' });
    }

    // Get final cost
    const sharesInUnits = bestShares; // Already in units
    const costData = iface.encodeFunctionData('calculateCost', [marketId, outcomeIndex, sharesInUnits]);
    const costResult = await rawCall(MULTI_MARKET_ADDR, costData);
    const rawActualCost = BigInt(iface.decodeFunctionResult('calculateCost', costResult)[0]);

    // CRITICAL FIX: Contract scales by 1e12 internally, so divide by 1e12 to get USDC units
    const actualCost = rawActualCost / BigInt(1e12);
    const costFormatted = ethers.formatUnits(actualCost, 6);
    const sharesFormatted = ethers.formatUnits(bestShares, 18);
    console.log(`✅ Cost: $${costFormatted} for ${sharesFormatted} shares (rawCost: ${rawActualCost.toString()})`);

    if (userBalance < actualCost) {
      return res.status(400).json({
        success: false,
        error: `Insufficient balance. Have: $${balanceFormatted}, Need: $${costFormatted}`
      });
    }

    // Execute transaction
    // CRITICAL FIX: Contract bug - calculateCost returns 6 decimals, but compares against 18 decimal userBalances
    // We must pass maxCost in 6 decimals to match totalCost calculation in contract
    // actualCost is already in 6 decimals (USDC format)
    const maxCostWithSlippage = actualCost * BigInt(110) / BigInt(100); // 10% slippage, stays in 6 decimals

    console.log('🔍 [MULTI-BET DEBUG] Encoding transaction');
    console.log('🔍 [TX PARAMS]:', {
      user: normalizedAddress,
      marketId,
      outcomeIndex,
      shares: ethers.formatUnits(sharesInUnits, 18),
      sharesRaw: sharesInUnits.toString(),
      maxCost: ethers.formatUnits(maxCostWithSlippage, 6), // NOW IN 6 DECIMALS
      maxCostRaw: maxCostWithSlippage.toString(),
      actualCost: ethers.formatUnits(actualCost, 6),
      userBalance: ethers.formatUnits(userBalance, 18)
    });

    // CRITICAL DEBUG: Log parameters BEFORE encoding
    console.log('🔍 [PRE-ENCODE DEBUG] About to encode transaction with:');
    console.log('  normalizedAddress:', normalizedAddress, 'type:', typeof normalizedAddress);
    console.log('  marketId:', marketId, 'type:', typeof marketId);
    console.log('  outcomeIndex:', outcomeIndex, 'type:', typeof outcomeIndex);
    console.log('  sharesInUnits:', sharesInUnits.toString(), 'type:', typeof sharesInUnits);
    console.log('  maxCostWithSlippage:', maxCostWithSlippage.toString(), 'type:', typeof maxCostWithSlippage);

    // Validate parameters before encoding
    if (!normalizedAddress || typeof normalizedAddress !== 'string') {
      throw new Error(`Invalid normalizedAddress: ${normalizedAddress}`);
    }
    if (marketId === undefined || marketId === null) {
      throw new Error(`Invalid marketId: ${marketId}`);
    }
    if (outcomeIndex === undefined || outcomeIndex === null) {
      throw new Error(`Invalid outcomeIndex: ${outcomeIndex}`);
    }
    if (!sharesInUnits || sharesInUnits <= 0) {
      throw new Error(`Invalid sharesInUnits: ${sharesInUnits}`);
    }
    if (!maxCostWithSlippage || maxCostWithSlippage <= 0) {
      throw new Error(`Invalid maxCostWithSlippage: ${maxCostWithSlippage}`);
    }

    console.log('✅ [PRE-ENCODE DEBUG] All parameters validated');

    const buyData = iface.encodeFunctionData('buySharesFor', [
      normalizedAddress,
      marketId,
      outcomeIndex,
      sharesInUnits,
      maxCostWithSlippage
    ]);

    console.log('🔍 [POST-ENCODE DEBUG] buyData result:');
    console.log('  buyData:', buyData);
    console.log('  buyData type:', typeof buyData);
    console.log('  buyData length:', buyData ? buyData.length : 'NULL/UNDEFINED');
    console.log('  buyData first 66 chars:', buyData ? buyData.substring(0, 66) : 'N/A');

    // CRITICAL: Validate that transaction data was properly encoded
    if (!buyData || buyData === '0x' || buyData.length <= 10) {
      console.error('❌ [MULTI-BET ERROR] Failed to encode transaction data!');
      console.error('❌ [MULTI-BET ERROR] buyData:', buyData);
      console.error('❌ [MULTI-BET ERROR] Parameters:', {
        normalizedAddress,
        marketId,
        outcomeIndex,
        sharesInUnits: sharesInUnits.toString(),
        maxCostWithSlippage: maxCostWithSlippage.toString()
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to encode transaction data. Please try again or contact support.'
      });
    }

    console.log('✅ [MULTI-BET DEBUG] Transaction data encoded successfully, length:', buyData.length);

    const txRequest = {
      to: MULTI_MARKET_ADDR,
      data: buyData,
      gasLimit: 500000
    };

    console.log('🔍 [MULTI-BET DEBUG] Transaction request object:');
    console.log('  to:', txRequest.to);
    console.log('  data:', txRequest.data);
    console.log('  data length:', txRequest.data ? txRequest.data.length : 'NULL');
    console.log('  gasLimit:', txRequest.gasLimit);

    console.log('🔍 [MULTI-BET DEBUG] Sending transaction');
    const tx = await signer.sendTransaction(txRequest);

    console.log('🔍 [POST-SEND DEBUG] Transaction sent, inspecting tx object:');
    console.log('  tx.hash:', tx.hash);
    console.log('  tx.to:', tx.to);
    console.log('  tx.data:', tx.data);
    console.log('  tx.from:', tx.from);
    console.log('  tx.gasLimit:', tx.gasLimit ? tx.gasLimit.toString() : 'undefined');

    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error('Transaction receipt is null');
    }

    console.log(`✅ Multi-bet executed! TX: ${receipt.hash}`);

    // Get new price
    const priceData = iface.encodeFunctionData('getPrice', [marketId, outcomeIndex]);
    const priceResult = await rawCall(MULTI_MARKET_ADDR, priceData);
    const newPrice = Number(iface.decodeFunctionResult('getPrice', priceResult)[0]) / 100;

    // Trigger immediate market sync so UI updates instantly
    console.log('[MULTI-BET] Triggering immediate market sync...');
    try {
      const { syncAllMarkets } = await import('./services/marketIndexer');
      syncAllMarkets().catch(err => console.error('[MULTI-BET] Sync failed:', err));
    } catch (error) {
      console.error('[MULTI-BET] Failed to trigger sync:', error);
    }

    return res.json({
      success: true,
      transaction: {
        hash: receipt.hash,
        shares: ethers.formatUnits(bestShares, 18),
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
    const rpcUrl = CONFIG.RPC_URL;
    const provider = new ethers.JsonRpcProvider(rpcUrl, parseInt(process.env.CHAIN_ID || '56'));

    const MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MARKET_ADDRESS || process.env.MARKET_CONTRACT;
    if (!MARKET_ADDR) throw new Error("Missing MARKET_ADDRESS env var");
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

    const rpcUrl = CONFIG.RPC_URL;
    const privateKey = process.env.PRIVATE_KEY;

    if (!privateKey) {
      return res.status(500).json({ success: false, error: 'Server wallet not configured' });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl, parseInt(process.env.CHAIN_ID || '56'));
    const signer = new ethers.Wallet(privateKey, provider);

    const USDC_ADDR = process.env.NEXT_PUBLIC_USDC_CONTRACT || process.env.USDC_CONTRACT;
    if (!USDC_ADDR) throw new Error("Missing USDC_CONTRACT env var");
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
    const rpcUrl = CONFIG.RPC_URL;
    const privateKey = process.env.PRIVATE_KEY;

    if (!privateKey) {
      return res.status(500).json({ success: false, error: 'Server wallet not configured' });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl, parseInt(process.env.CHAIN_ID || '56'));
    const signer = new ethers.Wallet(privateKey, provider);

    const USDC_ADDR = process.env.NEXT_PUBLIC_USDC_CONTRACT || process.env.USDC_ADDRESS;
    if (!USDC_ADDR) throw new Error("Missing USDC_ADDRESS env var");
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

    const rpcUrl = CONFIG.RPC_URL;
    const provider = new ethers.JsonRpcProvider(rpcUrl, parseInt(process.env.CHAIN_ID || '56'));

    const MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MARKET_CONTRACT || process.env.MARKET_ADDRESS;
    const USDC_ADDR = process.env.NEXT_PUBLIC_USDC_CONTRACT || process.env.USDC_CONTRACT;

    if (!MARKET_ADDR) throw new Error("Missing MARKET_ADDRESS env var");
    if (!USDC_ADDR) throw new Error("Missing USDC_CONTRACT env var");

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
    const rpcUrl = CONFIG.RPC_URL;
    const provider = new ethers.JsonRpcProvider(rpcUrl, parseInt(process.env.CHAIN_ID || '56'));

    const MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MARKET_CONTRACT || process.env.MARKET_ADDRESS;
    if (!MARKET_ADDR) throw new Error("Missing MARKET_ADDRESS env var");
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
    const rpcUrl = CONFIG.RPC_URL; // Default to public RPC if main failed
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) throw new Error('Server wallet not configured');

    const provider = new ethers.JsonRpcProvider(rpcUrl, parseInt(process.env.CHAIN_ID || '56'));
    const signer = new ethers.Wallet(privateKey, provider);

    // Get Contract
    const MULTI_MARKET_ADDR = process.env.MULTI_MARKET_ADDRESS || '0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6';
    const marketABI = [
      // V3 function - auto-calculates liquidity as (outcomes.length * 100 * 1e6)
      'function createMarketV3(string memory _question, string memory _image, string memory _description, string[] memory _outcomes, uint256 _durationDays) external returns (uint256)',
      'function marketCount() view returns (uint256)'
    ];
    const contract = new ethers.Contract(MULTI_MARKET_ADDR, marketABI, signer);

    // Convert duration to days (V3 uses days, not seconds)
    const durationDays = Math.ceil((durationHours || 24) / 24);

    console.log(`[Admin] Using V3 createMarketV3 - liquidity will auto-calculate to ${outcomes.length * 100} USDC`);

    // Call V3 createMarketV3 - NO manual liquidity parameter needed!
    const tx = await contract.createMarketV3(
      question,
      image || '',           // V3 requires image
      description || '',     // V3 requires description  
      outcomes,
      durationDays
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

// ADMIN CREATE MARKET V2 ENDPOINT - SIMPLIFIED
app.post('/api/admin/create-market-v2', async (req, res) => {
  try {
    const { ethers } = await import('ethers');
    const adminSecret = req.headers['x-admin-secret'];

    // Validate secret key
    const VALID_SECRET = process.env.ADMIN_SECRET || 'admin123';
    if (adminSecret !== VALID_SECRET) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { question, outcomes, category, image, description, durationDays } = req.body;

    if (!question || !outcomes || outcomes.length < 2) {
      return res.status(400).json({ success: false, error: 'Invalid market data' });
    }

    console.log(`[Admin V2] Creating market: "${question}" with ${outcomes.length} outcomes for ${durationDays} days`);

    // Setup Provider & Signer
    const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-testnet.bnbchain.org';
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) throw new Error('Server wallet not configured');

    const provider = new ethers.JsonRpcProvider(rpcUrl, parseInt(process.env.CHAIN_ID || '56'));
    const signer = new ethers.Wallet(privateKey, provider);

    // Get Contract
    const MULTI_MARKET_ADDR = process.env.MULTI_MARKET_ADDRESS || '0x95BEec73d2F473bB9Df7DC1b65637fB4CFc047Ae';
    const marketABI = [
      // V3 function - auto-calculates liquidity
      'function createMarketV3(string memory _question, string memory _image, string memory _description, string[] memory _outcomes, uint256 _durationDays) external returns (uint256)',
      'function marketCount() view returns (uint256)'
    ];
    const contract = new ethers.Contract(MULTI_MARKET_ADDR, marketABI, signer);

    console.log(`[Admin V3] Creating market with auto-calculated liquidity: ${outcomes.length * 100} USDC`);

    const tx = await contract.createMarketV3(
      question,
      image || "",
      description || "",
      outcomes,
      parseInt(durationDays) // V3 uses days as integer
    );

    console.log(`[Admin V2] TX Sent: ${tx.hash}`);
    await tx.wait();

    // Get the new Market ID
    const count = await contract.marketCount();
    const newMarketId = Number(count) - 1;

    console.log(`[Admin V2] Market Created. ID: ${newMarketId}`);

    // Save Metadata to DB
    await query(
      `INSERT INTO markets (market_id, question, description, image, category, outcome_names)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (market_id) DO UPDATE 
       SET question = $2, description = $3, image = $4, category = $5, outcome_names = $6`,
      [newMarketId, question, description, image, category, JSON.stringify(outcomes)]
    );

    return res.json({ success: true, marketId: newMarketId, txHash: tx.hash });

  } catch (error: any) {
    console.error('Create market V2 error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});


// GET MARKETS ENDPOINT
app.get('/api/markets', async (req, res) => {
  try {
    // CRITICAL: Prevent caching - data must be fresh from blockchain
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    console.log('[Markets API] Fetching markets from database (indexed)...');

    // Query all markets from database
    const result = await query(`
      SELECT
    market_id,
      question,
      image as image_url,
      description,
      category as category_id,
      outcome_names,
      prices,
      end_time,
      liquidity_param,
      outcome_count,
      resolved,
      winning_outcome,
      boost_tier,
      boost_expires_at,
      last_indexed_at,
      created_at,
      volume
      FROM markets
      ORDER BY market_id ASC
      `);

    const markets = result.rows.map((row: any) => {
      // Parse outcome names (JSONB or array)
      let outcomes = ['Yes', 'No'];
      if (row.outcome_names) {
        try {
          outcomes = typeof row.outcome_names === 'string'
            ? JSON.parse(row.outcome_names)
            : row.outcome_names;
        } catch (e) {
          console.warn(`[Markets API] Failed to parse outcome_names for market ${row.market_id}`);
        }
      }

      // Parse prices (JSONB stored by indexer)
      let prices = outcomes.map(() => 50); // Default 50/50
      if (row.prices) {
        try {
          prices = typeof row.prices === 'string'
            ? JSON.parse(row.prices)
            : row.prices;
        } catch (e) {
          console.warn(`[Markets API] Failed to parse prices for market ${row.market_id}`);
        }
      }

      // Check if boosted
      const now = Date.now();
      const isBoosted = row.boost_tier && row.boost_expires_at && (new Date(row.boost_expires_at).getTime() > now);

      return {
        id: row.market_id,
        market_id: row.market_id,
        question: row.question,
        image_url: row.image_url || '',
        description: row.description || '',
        category_id: row.category_id || 'General',
        outcomes,
        prices,
        endTime: row.end_time ? Math.floor(new Date(row.end_time).getTime() / 1000) : 0,
        liquidityParam: row.liquidity_param || '0',
        outcomeCount: row.outcome_count || outcomes.length,
        resolved: row.resolved || false,
        winningOutcome: row.winning_outcome || 0,
        is_boosted: isBoosted,
        boost_tier: row.boost_tier,
        boost_expires_at: row.boost_expires_at ? Math.floor(new Date(row.boost_expires_at).getTime() / 1000) : null,
        last_indexed_at: row.last_indexed_at,
        created_at: row.created_at,

        volume: row.volume || '0',
        totalVolume: parseFloat(row.volume || '0').toFixed(2), // Pre-format for frontend display
      };
    });

    console.log(`[Markets API] ✅ Returned ${markets.length} markets from DB (0 RPC calls)`);

    return res.json({
      success: true,
      markets,
      source: 'database_indexed',
      last_sync: markets[0]?.last_indexed_at || null
    });

  } catch (error: any) {
    console.error('[Markets API] Database error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch markets'
    });
  }
});

// Declare global type for cache
declare global {
  var marketsCache: { data: any[] | null, lastFetch: number };
}

// GET SINGLE MARKET ENDPOINT - Fetch from contract
app.get('/api/markets/:id', async (req, res) => {
  try {
    const { ethers } = await import('ethers');
    const marketId = parseInt(req.params.id);

    if (isNaN(marketId) || marketId < 0) {
      return res.status(400).json({ success: false, message: 'Invalid market ID' });
    }

    const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-rpc.publicnode.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl, parseInt(process.env.CHAIN_ID || '56'));
    // FORCE CORRECT CONTRACT
    const MARKET_ADDR = '0xe3Eb84D7e271A5C44B27578547f69C80c497355B';
    // const MARKET_ADDR = process.env.MARKET_CONTRACT || process.env.MARKET_ADDRESS || '0xe3Eb84D7e271A5C44B27578547f69C80c497355B';

    const marketABI = [
      'function marketCount() view returns (uint256)',
      'function getMarketBasicInfo(uint256) view returns (string question, string image, string description, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)',
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

    // Get metadata from database - REQUIRED (Acts as deletion check)
    let metadata: any = null;
    try {
      const metadataResult = await query('SELECT * FROM markets WHERE market_id = $1', [marketId]);
      if (metadataResult.rows.length > 0) {
        metadata = metadataResult.rows[0];
      }
    } catch (e) {
      // Database error
    }

    // If not in DB, treat as not found (Deleted)
    if (!metadata) {
      return res.status(404).json({ success: false, message: 'Market not active' });
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
    const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-rpc.publicnode.com';
    const chainId = parseInt(process.env.CHAIN_ID || '97');
    // Create provider without enforcing chain ID to avoid network mismatch errors
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const MARKET_ADDR = process.env.MARKET_CONTRACT || process.env.MARKET_ADDRESS || '0xA7DEd30e8A292dAA8e75A8d288393f8e290f9717';

    console.log(`[Admin Stats] Using RPC: ${rpcUrl}, Chain: ${chainId} `);

    const marketABI = [
      'function marketCount() view returns (uint256)',
      'function getMarketBasicInfo(uint256 marketId) view returns (string question, string image, string description, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)'
    ];
    const marketContract = new ethers.Contract(MARKET_ADDR, marketABI, provider);

    console.log(`[Admin Stats] Fetching marketCount from ${MARKET_ADDR}...`);
    let marketCount = 0;
    try {
      marketCount = Number(await marketContract.marketCount());
      console.log(`[Admin Stats]marketCount success: ${marketCount}`);
    } catch (e: any) {
      console.error(`[Admin Stats]marketCount FAILED: ${e.message}`);
    }

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
          console.log(`[Admin Stats]Market ${i} info failed: ${e.message?.slice(0, 50)}`);
          // Still count it as active if we can't get details
          activeCount++;
        }
      }
      activeMarkets = activeCount;
    } catch (e) {
      console.log('[Admin Stats] Detailed market scan failed, using marketCount');
      activeMarkets = marketCount;
    }

    // 4. Calculate Total Liquidity (with error handling)
    let totalLiquidity = 0;
    let liquidityTrend = 'Unknown';
    try {
      const USDC_ADDR = process.env.USDC_CONTRACT || process.env.USDC_ADDRESS || '0x87D45E316f5f1f2faffCb600c97160658B799Ee0';
      console.log(`[Admin Stats]Fetching USDC balance from ${USDC_ADDR} for market ${MARKET_ADDR}`);
      const erc20ABI = ['function balanceOf(address) view returns (uint256)'];
      const usdcContract = new ethers.Contract(USDC_ADDR, erc20ABI, provider);
      const contractBalanceWei = await usdcContract.balanceOf(MARKET_ADDR);
      totalLiquidity = parseFloat(ethers.formatUnits(contractBalanceWei, 6));
      liquidityTrend = totalLiquidity > 0 ? 'Stable' : 'Awaiting deposits';
      console.log(`[Admin Stats] Total liquidity: $${totalLiquidity} `);
    } catch (e: any) {
      console.error(`[Admin Stats] Liquidity check FAILED: ${e.message} `);
      liquidityTrend = 'Error fetching';
    }

    return res.json({
      success: true,
      stats: {
        totalLiquidity: `$${totalLiquidity.toLocaleString(undefined, { minimumFractionDigits: 2 })} `,
        totalVolume: `$${totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })} `,
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

// SAVE MARKET METADATA ENDPOINT (Public - for users who created markets via contract)
app.post('/api/markets/metadata', async (req, res) => {
  try {
    const { marketId, question, description, image, category, outcome_names } = req.body;

    if (marketId === undefined || !question) {
      return res.status(400).json({ success: false, error: 'Missing marketId or question' });
    }

    console.log(`[Metadata] Saving metadata for market ${marketId}`);

    await query(
      `INSERT INTO markets(market_id, question, description, image, category, outcome_names)
VALUES($1, $2, $3, $4, $5, $6)
       ON CONFLICT(market_id) DO UPDATE 
       SET question = $2, description = $3, image = $4, category = $5, outcome_names = $6`,
      [marketId, question, description || '', image || '', category || 'General', outcome_names ? JSON.stringify(outcome_names) : null]
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

    const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-rpc.publicnode.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl, parseInt(process.env.CHAIN_ID || '56'));
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
    // Get weighted average entry price for each market and side
    // Also calculating total volume and accuracy
    const result = await query(
      `SELECT
t.market_id,
  t.side,
  SUM(t.total_cost) as total_cost,
  SUM(t.shares) as total_shares,
  SUM(t.total_cost) / NULLIF(SUM(t.shares), 0) as avg_price,
  m.resolved,
  m.winning_outcome
         FROM trades t
         LEFT JOIN markets m ON t.market_id = m.market_id
         WHERE LOWER(t.user_address) = LOWER($1) OR LOWER(t.user_address) = 'external_wallet'
         GROUP BY t.market_id, t.side, m.resolved, m.winning_outcome`,
      [address]
    );

    const stats: Record<string, any> = {};
    let totalVolume = 0;
    let totalResolvedSubmissions = 0;
    let totalWins = 0;

    result.rows.forEach((row: any) => {
      // Portfolio Stats Key
      const key = `${row.market_id} -${row.side} `;
      stats[key] = {
        marketId: row.market_id,
        side: row.side,
        avgPrice: parseFloat(row.avg_price),
        totalCost: parseFloat(row.total_cost),
        totalShares: parseFloat(row.total_shares)
      };

      // Aggregate Volume
      totalVolume += parseFloat(row.total_cost);

      // Calculate Accuracy (Win Rate)
      // Only count markets that have resolved
      if (row.resolved) {
        // Simple heuristic: A "trade" row represents a position. 
        // If the user BET on the winning outcome, it's a "win". 
        // Note: This counts unique (Market, Side) pairs as one "submission/prediction". 
        // E.g. Betting on YES multiple times counts as 1 "prediction" for YES.

        totalResolvedSubmissions++;

        const winningOutcomeIndex = Number(row.winning_outcome);
        let isWin = false;

        // Convention: NO = 0, YES = 1 (Binary) or Outcome Index matching
        if (row.side === 'YES' && winningOutcomeIndex === 1) isWin = true;
        else if (row.side === 'NO' && winningOutcomeIndex === 0) isWin = true;
        // Handle multi-outcome (side might be '1', '2' etc if stored that way, or just binary logic for now)
        // Adjust based on your schema. Assuming 'YES'/'NO' text for now from previous context.

        if (isWin) {
          totalWins++;
        }
      }
    });

    // Accuracy Calculation
    const accuracyRate = totalResolvedSubmissions > 0
      ? Math.round((totalWins / totalResolvedSubmissions) * 100)
      : 0; // Default to 0 or null? 0 is fine.

    return res.json({
      success: true,
      stats,
      userStats: {
        totalVolume,
        accuracyRate
      }
    });
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
--Enable UUID extension
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--Users Table
      CREATE TABLE IF NOT EXISTS users(
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number VARCHAR(50) UNIQUE NOT NULL,
  wallet_address VARCHAR(42),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

--Wallets Table(for custodial users)
      CREATE TABLE IF NOT EXISTS wallets(
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  public_address VARCHAR(42) NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  balance DECIMAL(18, 6) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

--Auth Tokens Table(Magic Links)
      CREATE TABLE IF NOT EXISTS auth_tokens(
  token VARCHAR(255) PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE
);

--User Positions Table(Track bets)
      CREATE TABLE IF NOT EXISTS positions(
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  market_id INTEGER NOT NULL,
  side VARCHAR(3) NOT NULL CHECK(side IN('YES', 'NO')),
  shares DECIMAL(18, 6) NOT NULL,
  cost_basis DECIMAL(18, 6) NOT NULL,
  tx_hash VARCHAR(66),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

--Trades Table(Granular trade history for PnL)
      CREATE TABLE IF NOT EXISTS trades(
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  market_id INTEGER NOT NULL,
  user_address VARCHAR(42) NOT NULL,
  side VARCHAR(3) NOT NULL CHECK(side IN('YES', 'NO')),
  shares DECIMAL(18, 6) NOT NULL,
  price_per_share DECIMAL(18, 6) NOT NULL,
  total_cost DECIMAL(18, 6) NOT NULL,
  tx_hash VARCHAR(66),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

--Transactions Table(Deposits, Withdrawals, Bets)
      CREATE TABLE IF NOT EXISTS transactions(
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK(type IN('DEPOSIT', 'WITHDRAW', 'BET', 'CLAIM')),
  amount DECIMAL(18, 6) NOT NULL,
  tx_hash VARCHAR(66),
  status VARCHAR(20) DEFAULT 'PENDING',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

--Price History Table(for charts)
      CREATE TABLE IF NOT EXISTS price_history(
  id SERIAL PRIMARY KEY,
  market_id INTEGER NOT NULL,
  price INTEGER NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

--Comments Table
      CREATE TABLE IF NOT EXISTS comments(
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  market_id INTEGER NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
      CREATE INDEX IF NOT EXISTS idx_comments_market_id ON comments(market_id);

--Add columns for Market Indexer
      ALTER TABLE markets ADD COLUMN IF NOT EXISTS prices JSONB;
      ALTER TABLE markets ADD COLUMN IF NOT EXISTS liquidity_param VARCHAR(50);
      ALTER TABLE markets ADD COLUMN IF NOT EXISTS outcome_count INTEGER DEFAULT 2;
      ALTER TABLE markets ADD COLUMN IF NOT EXISTS last_indexed_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE markets ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

--Add boost columns
      ALTER TABLE markets ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT FALSE;
      ALTER TABLE markets ADD COLUMN IF NOT EXISTS boost_expires_at BIGINT DEFAULT 0;
      ALTER TABLE markets ADD COLUMN IF NOT EXISTS boost_tier INT DEFAULT 0;

--Create indexes for performance
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


// NUKE MARKETS ENDPOINT (Triggered via Link)
app.get('/api/admin/nuke-markets', async (req, res) => {
  try {
    const { query } = await import('./config/database');
    const secret = req.query.secret;

    // Validate secret
    const VALID_SECRET = process.env.ADMIN_SECRET || 'admin123';
    if (secret !== VALID_SECRET) {
      return res.status(401).send('Unauthorized: Invalid Secret');
    }

    console.log('[Admin] Nuking markets table via API...');
    await query('TRUNCATE TABLE markets CASCADE');
    console.log('[Admin] Markets nuked successfully.');

    res.send(`
  <h1>✅ Markets Nuked Successfully </h1>
    < p > The database metadata has been cleared.</p>
      < p > The Bot and App will now fetch fresh data from the Blockchain.</p>
        < a href = "/" > Go Home </a>
          `);
  } catch (error: any) {
    console.error('Nuke error:', error);
    res.status(500).send(`❌ Error: ${error.message} `);
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

// USER REGISTRATION ENDPOINTS
app.post('/api/register', async (req, res) => {
  try {
    const { walletAddress, username } = req.body;

    if (!walletAddress || !username) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const avatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(username)}`;

    // Check if user exists
    const userRes = await query('SELECT * FROM users WHERE LOWER(wallet_address) = $1', [walletAddress.toLowerCase()]);

    let user;
    if (userRes.rows.length > 0) {
      // Update existing user
      const updateRes = await query(
        'UPDATE users SET display_name = $1, avatar_url = $2 WHERE id = $3 RETURNING *',
        [username, avatarUrl, userRes.rows[0].id]
      );
      user = updateRes.rows[0];
    } else {
      // Create new user
      const insertRes = await query(
        'INSERT INTO users (wallet_address, display_name, avatar_url) VALUES ($1, $2, $3) RETURNING *',
        [walletAddress, username, avatarUrl]
      );
      user = insertRes.rows[0];
    }

    res.json({ success: true, user });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/user/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const userRes = await query('SELECT * FROM users WHERE LOWER(wallet_address) = $1', [address.toLowerCase()]);

    if (userRes.rows.length > 0) {
      res.json({ success: true, user: userRes.rows[0] });
    } else {
      res.json({ success: true, user: null });
    }
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: error.message });
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

// General Health Check (no auth required) - for CORS verification
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    service: 'OPOLL Backend API',
    timestamp: new Date().toISOString()
  });
});

// Initialize DB and start server
// Initialize Socket.IO
const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket'] // WebSocket only, no polling
});

// Socket.IO event handlers for real-time chat
io.on('connection', (socket) => {
  console.log('✅ WebSocket client connected:', socket.id);

  // Join market room
  socket.on('join-market', (marketId: string) => {
    socket.join(`market-${marketId}`);
    console.log(`Socket ${socket.id} joined market-${marketId}`);
  });

  // Leave market room
  socket.on('leave-market', (marketId: string) => {
    socket.leave(`market-${marketId}`);
    console.log(`Socket ${socket.id} left market-${marketId}`);
  });

  // Handle new comment
  socket.on('send-comment', async (data: { marketId: string; text: string; walletAddress: string; parentId?: string }) => {
    console.log('📨 Received send-comment event:', data);
    try {
      const { marketId, text, walletAddress, parentId } = data;

      // Validate
      if (marketId === undefined || !text || !walletAddress) {
        socket.emit('comment-error', { error: 'Missing required fields' });
        return;
      }

      // Check if user exists
      let userResult = await query(
        'SELECT * FROM users WHERE LOWER(wallet_address) = $1',
        [walletAddress.toLowerCase()]
      );

      let user;

      // Auto-register if user doesn't exist
      if (userResult.rows.length === 0) {
        console.log(`ℹ️ Auto-registering user for comment: ${walletAddress}`);
        const defaultName = `User ${walletAddress.slice(0, 6)}`;
        const avatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${walletAddress}`;

        const insertRes = await query(
          'INSERT INTO users (wallet_address, display_name, avatar_url) VALUES ($1, $2, $3) RETURNING *',
          [walletAddress, defaultName, avatarUrl]
        );
        user = insertRes.rows[0];
      } else {
        user = userResult.rows[0];
      }

      console.log(`✅ User verified for comment:`, user.display_name);

      // Insert comment
      console.log(`💾 Inserting comment into database...`);
      const insertResult = await query(
        `INSERT INTO comments (market_id, user_id, text, parent_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, created_at`,
        [marketId, user.id, text, parentId || null]
      );
      console.log(`✅ Comment inserted:`, insertResult.rows[0]);

      const newComment = {
        id: insertResult.rows[0].id,
        text,
        created_at: insertResult.rows[0].created_at,
        wallet_address: walletAddress,
        display_name: user.display_name || 'Web User',
        avatar_url: user.avatar_url,
        likes: 0,
        dislikes: 0,
        parent_id: parentId || null,
        reply_count: 0
      };

      // Broadcast to all clients in the market room
      console.log(`📡 Broadcasting comment to market-${marketId}...`);
      io.to(`market-${marketId}`).emit('new-comment', newComment);
      console.log(`📨 Comment broadcast successful:`, newComment);

    } catch (error: any) {
      console.error('❌ Socket comment error:', error);
      console.error('❌ Error stack:', error.stack);
      socket.emit('comment-error', { error: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ WebSocket client disconnected:', socket.id);
  });
});

initDatabase().then(async () => {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 WebSocket server ready`);
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

  // Start Market Indexer (Syncs blockchain state to DB every 30 seconds for efficient API responses)
  // Start Market Indexer (Syncs blockchain state to DB every 30 seconds for efficient API responses)
  if (process.env.DATABASE_URL) {
    console.log('[Startup] 🔄 initializing market indexer...');
    try {
      const { startMarketIndexer } = await import('./services/marketIndexer');
      console.log('[Startup] ✅ Starting market indexer with 30s interval');
      startMarketIndexer(30000); // Sync every 30 seconds
    } catch (e: any) {
      console.error('[Startup] ❌ Failed to start market indexer:', e.message);
    }
  } else {
    console.warn('[Startup] ⚠️ Market indexer disabled: DATABASE_URL not set');
  }

}).catch(err => {
  console.error("⚠️ Database Initialization Failed:", err.message);
  console.log("⚠️ STARTING IN OFFLINE MODE: Database features will check for connectivity or return mock data.");
  // Do not exit, allow server to run for API endpoints that don't need DB or have fallbacks
});