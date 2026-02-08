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
 * Sync all active markets from blockchain to database using Multicall3
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

        // Multicall3 on BSC Mainnet
        const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
        const MULTICALL3_ABI = [
            'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[] returnData)'
        ];

        const marketInterface = new ethers.Interface(MARKET_ABI);
        const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);

        // Build multicall batch: 3 calls per market (basicInfo, outcomes, prices)
        const calls: any[] = [];
        const marketIds: number[] = [];

        for (let marketId = 0; marketId < marketCount; marketId++) {
            marketIds.push(marketId);

            // Call 1: getMarketBasicInfo
            calls.push({
                target: MARKET_ADDR,
                allowFailure: true,
                callData: marketInterface.encodeFunctionData('getMarketBasicInfo', [marketId])
            });

            // Call 2: getMarketOutcomes
            calls.push({
                target: MARKET_ADDR,
                allowFailure: true,
                callData: marketInterface.encodeFunctionData('getMarketOutcomes', [marketId])
            });

            // Call 3: getAllPrices
            calls.push({
                target: MARKET_ADDR,
                allowFailure: true,
                callData: marketInterface.encodeFunctionData('getAllPrices', [marketId])
            });
        }

        console.log(`[Indexer] Syncing ${marketCount} markets...`);
        console.log(`[Indexer] 📞 Executing Multicall3 with ${calls.length} calls...`);
        const startTime = Date.now();

        // Execute single multicall batch
        const responses = await multicall.aggregate3(calls);

        console.log(`[Indexer] ✅ Multicall3 completed in ${Date.now() - startTime}ms`);

        // Decode responses and update database
        for (let index = 0; index < marketIds.length; index++) {
            const marketId = marketIds[index];
            const baseIndex = index * 3; // Each market has 3 calls

            const basicInfoResponse = responses[baseIndex];
            const outcomesResponse = responses[baseIndex + 1];
            const pricesResponse = responses[baseIndex + 2];

            try {
                // Decode basic info
                const basicInfo = basicInfoResponse.success
                    ? marketInterface.decodeFunctionResult('getMarketBasicInfo', basicInfoResponse.returnData)
                    : null;

                // Decode outcomes
                const outcomes = outcomesResponse.success
                    ? marketInterface.decodeFunctionResult('getMarketOutcomes', outcomesResponse.returnData)[0]
                    : ['Yes', 'No'];

                // Decode prices
                const prices = pricesResponse.success
                    ? marketInterface.decodeFunctionResult('getAllPrices', pricesResponse.returnData)[0]
                    : [BigInt(5000), BigInt(5000)];

                if (!basicInfo) {
                    console.warn(`[Indexer] Market ${marketId}: basicInfo call failed, skipping`);
                    continue;
                }

                const pricesFormatted = prices.map((p: bigint) => Number(p) / 100);

                // Insert or update market
                await query(
                    `INSERT INTO markets (market_id, question, description, image, outcome_names, prices, resolved, winning_outcome, end_time, liquidity_param, outcome_count, last_indexed_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
                     ON CONFLICT (market_id) DO UPDATE 
                     SET prices = $6,
                         resolved = $7,
                         winning_outcome = $8,
                         end_time = $9,
                         liquidity_param = $10,
                         outcome_count = $11,
                         last_indexed_at = NOW()`,
                    [
                        marketId,
                        basicInfo.question,
                        basicInfo.description,
                        basicInfo.image,
                        JSON.stringify(outcomes),
                        JSON.stringify(pricesFormatted),
                        basicInfo.resolved,
                        Number(basicInfo.winningOutcome),
                        new Date(Number(basicInfo.endTime) * 1000),
                        ethers.formatUnits(basicInfo.liquidityParam, 18),
                        Number(basicInfo.outcomeCount),
                    ]
                );

                console.log(`[Indexer] Synced market ${marketId}`);
            } catch (error: any) {
                console.error(`[Indexer] Failed to sync market ${marketId}:`, error.message);
            }
        }

        console.log(`[Indexer] ✅ Sync complete - ${marketCount} markets updated`);
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
