/**
 * Market Indexer Service
 * Syncs blockchain market state to PostgreSQL database periodically
 * Reduces RPC calls from O(N * requests) to O(N * interval)
 */

import { ethers } from 'ethers';
import { getProvider } from '../config/provider';
import { query } from '../config/database';
import { CONFIG } from '../config/contracts';

const MARKET_ABI = [
    'function marketCount() view returns (uint256)',
    'function getMarketBasicInfo(uint256) view returns (string question, string image, string description, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)',
    'function getMarketOutcomes(uint256) view returns (string[])',
    'function getAllPrices(uint256) view returns (uint256[])',
];

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

/**
 * Sync a single market's state to the database
 */
async function syncMarket(marketId: number, marketContract: ethers.Contract): Promise<void> {
    try {
        const [basicInfo, outcomes, prices] = await Promise.all([
            marketContract.getMarketBasicInfo(marketId),
            marketContract.getMarketOutcomes(marketId),
            marketContract.getAllPrices(marketId),
        ]);

        // Convert prices to simple number array (basis points to percentages)
        const pricesFormatted = prices.map((p: bigint) => Number(p) / 100);

        // Update database with current market state
        await query(
            `UPDATE markets 
             SET prices = $1,
                 resolved = $2,
                 winning_outcome = $3,
                 end_time = $4,
                 liquidity_param = $5,
                 outcome_count = $6,
                 last_indexed_at = NOW()
             WHERE market_id = $7`,
            [
                JSON.stringify(pricesFormatted),
                basicInfo.resolved,
                Number(basicInfo.winningOutcome),
                new Date(Number(basicInfo.endTime) * 1000),
                ethers.formatUnits(basicInfo.liquidityParam, 18),
                Number(basicInfo.outcomeCount),
                marketId,
            ]
        );

        console.log(`[Indexer] Synced market ${marketId}`);
    } catch (error: any) {
        console.error(`[Indexer] Failed to sync market ${marketId}:`, error.message);
    }
}

/**
 * Sync all active markets from blockchain to database
 */
export async function syncAllMarkets(): Promise<void> {
    try {
        const provider = getProvider();
        const MARKET_ADDR = CONFIG.MARKET_CONTRACT;

        if (!MARKET_ADDR) {
            console.error('[Indexer] Market contract address not configured');
            return;
        }

        const marketContract = new ethers.Contract(MARKET_ADDR, MARKET_ABI, provider);

        // Get total market count from blockchain
        const count = await marketContract.marketCount();
        const marketCount = Number(count);

        console.log(`[Indexer] Starting sync for ${marketCount} markets...`);

        // Get list of market IDs that exist in database (to avoid syncing deleted markets)
        const dbResult = await query('SELECT market_id FROM markets ORDER BY market_id');
        const validMarketIds = dbResult.rows.map((row: any) => row.market_id);

        // Filter to only sync markets that are both on-chain and in DB
        const marketsToSync = validMarketIds.filter((id: number) => id < marketCount);

        console.log(`[Indexer] Syncing ${marketsToSync.length} active markets...`);

        // Sync in batches to avoid overwhelming RPC
        const BATCH_SIZE = 5;
        for (let i = 0; i < marketsToSync.length; i += BATCH_SIZE) {
            const batch = marketsToSync.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map((id: number) => syncMarket(id, marketContract)));

            // Small delay between batches
            if (i + BATCH_SIZE < marketsToSync.length) {
                await new Promise(r => setTimeout(r, 200));
            }
        }

        console.log(`[Indexer] ✅ Sync complete - ${marketsToSync.length} markets updated`);
    } catch (error: any) {
        console.error('[Indexer] Sync failed:', error.message);
    }
}

/**
 * Start periodic market indexing
 * @param intervalMs - How often to sync (default: 30 seconds)
 */
export function startMarketIndexer(intervalMs: number = 30000): void {
    if (isRunning) {
        console.log('[Indexer] Already running');
        return;
    }

    console.log(`[Indexer] Starting with ${intervalMs / 1000}s interval...`);
    isRunning = true;

    // Run immediately on start
    syncAllMarkets();

    // Then run periodically
    intervalId = setInterval(syncAllMarkets, intervalMs);
    console.log(`[Indexer] ✅ Running`);
}

/**
 * Stop the market indexer
 */
export function stopMarketIndexer(): void {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    isRunning = false;
    console.log('[Indexer] ⏹️ Stopped');
}

/**
 * Check if indexer is running
 */
export function isIndexerRunning(): boolean {
    return isRunning;
}
