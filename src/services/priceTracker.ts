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
        // Record the first outcome price (typically "Yes" for binary markets)
        const priceValue = prices.length > 0 ? Number(prices[0]) : 5000; // Default to 50%

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
export async function recordAllMarketPrices(): Promise<void> {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const market = new ethers.Contract(MARKET_ADDR, MARKET_ABI, provider);

        const count = await market.marketCount();
        const marketCount = Number(count);

        for (let i = 0; i < marketCount; i++) {
            await recordMarketPrice(i);
        }

        console.log(`📊 Recorded prices for ${marketCount} markets`);
    } catch (error) {
        console.error('Failed to record market prices:', error);
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
