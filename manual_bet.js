
const { ethers } = require('ethers');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const util = require('util');
const crypto = require('crypto');

// Setup Logging
const logFile = fs.createWriteStream('manual_bet.log', { flags: 'w' });
const logStdout = process.stdout;
console.log = function () {
    logFile.write(util.format.apply(null, arguments) + '\n');
    logStdout.write(util.format.apply(null, arguments) + '\n');
}
console.error = function () {
    logFile.write(util.format.apply(null, arguments) + '\n');
    logStdout.write(util.format.apply(null, arguments) + '\n');
}

// Load environment variables
const result = dotenv.config({ path: '.env' });
if (result.error) {
    console.warn("Could not load .env file", result.error);
}

// DB Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const TARGET_WALLET = '0xD5EeB48921F15Cdc0863fAA841fc08F998b9e55f';
const MARKET_ID = 4;
const OUTCOME_INDEX = 1; // NO
const AMOUNT_USDC = '0.1';

// Encryption Keys
const ALGORITHM = 'aes-256-gcm';
const DEFAULT_KEY_HEX = '1ef5d56bb056a08019ea2f34e6540211eacfd3fff109bcf98d483da21db2b3c5';
let encryptEnv = process.env.ENCRYPTION_KEY || DEFAULT_KEY_HEX;
let KEY;
try {
    KEY = Buffer.from(encryptEnv, 'hex');
} catch (e) {
    KEY = Buffer.from(DEFAULT_KEY_HEX, 'hex');
}

function decrypt(encryptedData) {
    try {
        const parts = encryptedData.split(':');
        const [ivHex, authTagHex, encrypted] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        throw new Error(`Decryption failed: ${error.message}`);
    }
}

// ABIs
const PREDICTION_MARKET_ABI = [
    "function buyShares(uint256 marketId, uint256 outcomeIndex, uint256 shares, uint256 maxCost) external returns (uint256)",
    "function calculateCost(uint256 marketId, uint256 outcomeIndex, uint256 shares) public view returns (uint256)",
    "function getPrice(uint256 marketId, uint256 outcomeIndex) public view returns (uint256)",
    "function userBalances(address) view returns (uint256)"
];
const USDC_ABI = [
    "function approve(address spender, uint256 amount) public returns (bool)",
    "function allowance(address owner, address spender) public view returns (uint256)",
    "function balanceOf(address account) public view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function transfer(address to, uint256 amount) public returns (bool)"
];

async function main() {
    console.log(`[AdminBet] Target: ${TARGET_WALLET}`);
    console.log(`[AdminBet] Market: ${MARKET_ID}, Outcome: ${OUTCOME_INDEX} (NO), Amount: $${AMOUNT_USDC}`);

    // 1. Get Private Key
    const res = await pool.query("SELECT encrypted_private_key FROM wallets WHERE public_address = $1", [TARGET_WALLET]);
    if (!res.rows.length) throw new Error("Wallet not found in DB");

    const privateKey = decrypt(res.rows[0].encrypted_private_key);
    console.log('[AdminBet] Private Key retrieved.');

    // 2. Setup Provider
    const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org/';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log(`[AdminBet] User Address: ${wallet.address}`);

    // 3. Contracts
    const marketAddr = process.env.NEXT_PUBLIC_MARKET_ADDRESS || "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    const usdcAddr = process.env.NEXT_PUBLIC_USDC_CONTRACT || "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";

    const usdc = new ethers.Contract(usdcAddr, USDC_ABI, wallet);
    const market = new ethers.Contract(marketAddr, PREDICTION_MARKET_ABI, wallet);

    let decimals = 18;
    try { decimals = Number(await usdc.decimals()); } catch (e) { }

    const tradeAmountBN = ethers.parseUnits(AMOUNT_USDC, decimals);

    // 4. Check Internal Balance
    let internalBalance = 0n;
    try {
        internalBalance = await market.userBalances(wallet.address);
        console.log(`[AdminBet] Internal Contract Balance: ${ethers.formatUnits(internalBalance, decimals)} USDC`);
    } catch (e) {
        console.warn(`[AdminBet] failed to get userBalances: ${e.message}`);
    }

    let useInternal = false;
    // Robust check for > 0 handle BigInt (v6) and BigNumber (v5)
    const intBalStr = internalBalance.toString();
    const tradeAmountStr = tradeAmountBN.toString();

    // Compare via strings/conversion to be safe or just use internalBalance >= tradeAmountBN if types match (likely do since created from same lib)
    if (internalBalance >= tradeAmountBN) {
        console.log(`[AdminBet] Sufficient Internal Balance. Skipping USDC Check/Approve.`);
        useInternal = true;
    } else if (intBalStr !== "0") {
        // User has SOME internal balance (e.g. 0.0989), but less than target (0.1).
        console.log(`[AdminBet] Internal Balance (${ethers.formatUnits(internalBalance, decimals)}) < Target (${AMOUNT_USDC}). Using ALL available internal balance.`);
        useInternal = true;
    } else {
        // Check Wallet Balance
        const usdcBal = await usdc.balanceOf(wallet.address);
        console.log(`[AdminBet] Wallet USDC Balance: ${ethers.formatUnits(usdcBal, decimals)}`);

        if (usdcBal < tradeAmountBN) {
            throw new Error(`Insufficient Funds (Internal: ${ethers.formatUnits(internalBalance, decimals)}, Wallet: ${ethers.formatUnits(usdcBal, decimals)})`);
        }

        // Approve
        const allowance = await usdc.allowance(wallet.address, marketAddr);
        if (allowance < tradeAmountBN) {
            console.log('[AdminBet] Approving USDC...');
            const txApprove = await usdc.approve(marketAddr, ethers.MaxUint256);
            await txApprove.wait();
            console.log('[AdminBet] Approved.');
        }
    }

    // 5. Execute Trade
    const priceBN = await market.getPrice(MARKET_ID, OUTCOME_INDEX);
    const price = Number(priceBN);
    console.log(`[AdminBet] Price (Raw): ${price}`);

    // Heuristic: If price > 100, assume Basis Points (10000 = 100%)
    // If price <= 100, assume Percentage (100 = 100%)
    let priceFloat;
    if (price > 100) {
        priceFloat = price / 10000;
    } else {
        priceFloat = price / 100;
    }

    console.log(`[AdminBet] Price (Float): ${priceFloat}`);

    // LOGIC ADJUSTMENT: Check Amount vs Balance
    // "if it is not up to 0.1 usdc use all the money available"
    let finalTradeAmountBN = tradeAmountBN;

    // We strictly use internal balance if we are relying on contract inputs as user said "money is in the game contract"
    // So we limit by internalBalance
    if (internalBalance < tradeAmountBN) {
        console.log(`[AdminBet] Balance (${ethers.formatUnits(internalBalance, decimals)}) < Target (${AMOUNT_USDC}). Using ALL available.`);
        finalTradeAmountBN = internalBalance;
    } else {
        console.log(`[AdminBet] Balance sufficient. Using Target: ${AMOUNT_USDC}`);
    }

    if (finalTradeAmountBN === 0n) {
        throw new Error("Trade Amount is 0. User has no funds in contract.");
    }

    // Binary Search to MAXIMIZE shares for available balance
    // Goal: Find Max Shares S such that calculateCost(S) + Fee <= finalTradeAmountBN
    // We search over a range of shares.

    console.log(`[AdminBet] Executing Binary Search for Max Shares...`);

    // Initial guess: Balance / (Price * 1.05)
    // We use a wide range to be safe.
    // Low: 0
    // High: Balance / (Price * 0.5) [Assuming price dropped by half, very conservative]

    const priceEffective = priceFloat > 0 ? priceFloat : 0.5;
    const estimatedMaxShares = parseFloat(ethers.formatUnits(finalTradeAmountBN, decimals)) / (priceEffective * 0.9); // buffer high
    let low = 0n;
    let high = ethers.parseUnits((estimatedMaxShares * 2).toFixed(18), 18);
    let bestShares = 0n;
    let bestCost = 0n;

    // Limit iterations to avoid long execution (e.g. 20 steps is ~ 1M precision)
    for (let i = 0; i < 20; i++) {
        const mid = (low + high) / 2n;
        if (mid === 0n) {
            low = 1n; // can't imply 0 shares
            continue;
        }

        try {
            const cost = await market.calculateCost(MARKET_ID, OUTCOME_INDEX, mid);
            const fee = (cost * 500n) / 10000n; // 5%
            const total = cost + fee;

            if (total <= finalTradeAmountBN) {
                bestShares = mid;
                bestCost = total;
                low = mid + 1n; // Try more
            } else {
                high = mid - 1n; // Too expensive
            }
        } catch (e) {
            high = mid - 1n; // Reverted (likely overflow or error)
        }
    }

    // Fallback if binary search failed to find > 0 (unlikely)
    if (bestShares === 0n && finalTradeAmountBN > 0n) {
        // Try a very small amount
        bestShares = ethers.parseUnits("0.0001", 18);
    }

    console.log(`[AdminBet] Optimized Shares: ${ethers.formatUnits(bestShares, 18)}`);
    console.log(`[AdminBet] Expected Cost: ${ethers.formatUnits(bestCost, decimals)} (Max: ${ethers.formatUnits(finalTradeAmountBN, decimals)})`);

    console.log(`[AdminBet] Buying shares...`);
    const txBuy = await market.buyShares(MARKET_ID, OUTCOME_INDEX, bestShares, finalTradeAmountBN);
    console.log(`[AdminBet] Tx Sent: ${txBuy.hash}`);
    await txBuy.wait();
    console.log('[AdminBet] Trade Confirmed!');

    pool.end();
}

main().catch(err => {
    console.error(err);
    if (pool) pool.end();
});
