/**
 * Price Tracker Service
 * Records market prices to database for chart history
 */

import { ethers } from 'ethers';

import { CONFIG } from '../config/contracts';

// Configuration
const RPC_URL = CONFIG.RPC_URL;
const MARKET_ADDR = CONFIG.MARKET_CONTRACT;

const MARKET_ABI = [
    'function marketCount() view returns (uint256)',
    'function getAllPrices(uint256 marketId) view returns (uint256[])',
];

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

/**
 * Record current price for a specific market
 */
export async function recordMarketPrice(marketId: number): Promise<void> {
    try {
        const { query } = await import('../config/database');
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const market = new ethers.Contract(MARKET_ADDR, MARKET_ABI, provider);

        const prices = await market.getAllPrices(marketId);
        // Store outcome[0] as primary price (basis points: 5000 = 50%)
        const priceValue = prices.length > 0 ? Number(prices[0]) : 5000;

        // Deduplication: skip if price hasn't changed since last record
        const last = await query(
            'SELECT price FROM price_history WHERE market_id = $1 ORDER BY recorded_at DESC LIMIT 1',
            [marketId]
        );
        if (last.rows.length > 0 && last.rows[0].price === priceValue) {
            return; // No change, skip insert
        }

        await query(
            'INSERT INTO price_history (market_id, price) VALUES ($1, $2)',
            [marketId, priceValue]
        );

        console.log(`📊 Recorded price for market ${marketId}: ${priceValue / 100}%`);
    } catch (error) {
        console.error(`Failed to record price for market ${marketId}:`, error);
    }
}

/**
 * Record prices for all markets
 */
/**
 * Record prices for all markets
 */
export async function recordAllMarketPrices(): Promise<void> {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const market = new ethers.Contract(MARKET_ADDR, MARKET_ABI, provider);

        const count = await market.marketCount();
        const marketCount = Number(count);

        console.log(`📊 Recording prices for ${marketCount} markets...`);

        // Use the same provider for all calls
        // Run in chunks to avoid rate limits, but parallelize slightly
        const CHUNK_SIZE = 5;
        for (let i = 0; i < marketCount; i += CHUNK_SIZE) {
            const chunk = [];
            for (let j = 0; j < CHUNK_SIZE && i + j < marketCount; j++) {
                chunk.push(recordMarketPriceWithProvider(i + j, market));
            }
            await Promise.all(chunk);

            // Rate limit: Wait 1 second between chunks to respect QuickNode 50 req/sec limit
            if (i + CHUNK_SIZE < marketCount) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log(`✅ Recorded prices for ${marketCount} markets`);
    } catch (error) {
        console.error('Failed to record market prices:', error);
    }
}

async function recordMarketPriceWithProvider(marketId: number, marketContract: ethers.Contract): Promise<void> {
    try {
        const { query } = await import('../config/database');
        const prices = await marketContract.getAllPrices(marketId);
        // outcome[0] is stored as primary; basis points (5000 = 50%)
        const priceValue = prices.length > 0 ? Number(prices[0]) : 5000;

        // Deduplication: skip if price hasn't changed since last recorded value
        const last = await query(
            'SELECT price FROM price_history WHERE market_id = $1 ORDER BY recorded_at DESC LIMIT 1',
            [marketId]
        );
        if (last.rows.length > 0 && last.rows[0].price === priceValue) {
            return; // No change — skip insert to prevent table bloat
        }

        await query(
            'INSERT INTO price_history (market_id, price) VALUES ($1, $2)',
            [marketId, priceValue]
        );
    } catch (error) {
        console.error(`Failed to record price for market ${marketId}:`, error);
    }
}

/**
 * Get price history for a market
 */
export async function getPriceHistory(marketId: number, limit: number = 50): Promise<any[]> {
    try {
        const { query } = await import('../config/database');

        const result = await query(
            `SELECT price, recorded_at 
             FROM price_history 
             WHERE market_id = $1 
             ORDER BY recorded_at DESC 
             LIMIT $2`,
            [marketId, limit]
        );

        // Return in chronological order (oldest first) for charts
        return result.rows.reverse().map((row: any) => ({
            price: row.price / 100, // Convert to percentage
            time: new Date(row.recorded_at).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            }),
            timestamp: row.recorded_at
        }));
    } catch (error) {
        console.error('Failed to get price history:', error);
        return [];
    }
}

/**
 * Start periodic price tracking (every 5 minutes)
 */
export function startPriceTracker(intervalMs: number = 5 * 60 * 1000): void {
    if (isRunning) {
        console.log('⚠️ Price tracker already running');
        return;
    }

    console.log('🚀 Starting price tracker...');
    isRunning = true;

    // Record immediately on start
    recordAllMarketPrices();

    // Then record periodically
    intervalId = setInterval(recordAllMarketPrices, intervalMs);
    console.log(`✅ Price tracker running (interval: ${intervalMs / 1000}s)`);
}

/**
 * Stop price tracking
 */
export function stopPriceTracker(): void {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    isRunning = false;
    console.log('⏹️ Price tracker stopped');
}
