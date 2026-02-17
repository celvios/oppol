import { ethers } from 'ethers';
import { query } from '../config/database';
import { CONFIG } from '../config/contracts';
import { MARKET_ABI } from '../config/abis';
import { getProvider } from '../config/provider';

let isRunning = false;
let isSyncing = false;
let intervalId: NodeJS.Timeout | null = null;

// Helper to format prices
// Helper to format prices (contract returns basis points 10000 = 100%)
const formatPrices = (prices: bigint[]) => prices.map((p) => Number(p) / 100);

// Cache for incremental updates
interface MarketState {
    lastBlock: number;
    volume: bigint;
}
const marketCache: Map<number, MarketState> = new Map();

/**
 * Sync all active markets from blockchain to database using Multicall3
 */
export async function syncAllMarkets(): Promise<void> {
    if (isSyncing) {
        console.log('[Indexer] Sync in progress, skipping...');
        return;
    }
    isSyncing = true;

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
        const currentBlock = await provider.getBlockNumber();

        if (marketCount === 0) {
            console.log('[Indexer] No markets found on-chain');
            return;
        }

        console.log(`[Indexer] Starting sync for ${marketCount} markets at block ${currentBlock}...`);

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

        console.log(`[Indexer] Syncing ${marketIds.length} markets...`);
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
                // Check if all calls succeeded
                if (!basicInfoResponse.success || !outcomesResponse.success || !pricesResponse.success) {
                    console.warn(`[Indexer] Partial failure for market ${marketId}, skipping update.`);
                    continue;
                }

                // Decode basic info
                const basicInfo = marketInterface.decodeFunctionResult('getMarketBasicInfo', basicInfoResponse.returnData);

                // Decode outcomes
                const outcomes = marketInterface.decodeFunctionResult('getMarketOutcomes', outcomesResponse.returnData)[0];

                // Decode prices
                const prices = marketInterface.decodeFunctionResult('getAllPrices', pricesResponse.returnData)[0];

                // Format prices (e.g. 5000 -> 50.00)
                const pricesFormatted = formatPrices(prices);

                // --- Volume Calculation (Stateful) ---
                let volume = BigInt(0);

                // Get current state from DB
                const dbMarket = await query(
                    'SELECT volume, last_indexed_block FROM markets WHERE market_id = $1',
                    [marketId]
                );

                let lastIndexedBlock = 0;
                let isFirstRun = false;

                if (dbMarket.rows.length > 0) {
                    const row = dbMarket.rows[0];
                    volume = row.volume ? ethers.parseUnits(row.volume, 18) : BigInt(0);
                    lastIndexedBlock = row.last_indexed_block ? parseInt(row.last_indexed_block) : 0;
                } else {
                    isFirstRun = true;
                }

                // If never indexed, scan typically from recent or full history if critical
                // For this fixing task, if 0, we assume we need to scan DEEP or reset.
                // If lastIndexedBlock is 0, we can scan back a safe amount or just start now?
                // Better: If 0, scan last 1M blocks to be safe and populate backlog.
                if (lastIndexedBlock === 0) {
                    lastIndexedBlock = Math.max(0, currentBlock - 1000000);
                    // Reset volume if we are doing a fresh deep scan?
                    // No, keep existing volume if DB has it, but scanning might double count if we aren't careful.
                    // If DB has volume but block is 0, it means legacy data.
                    // We should probably TRUST DB volume and scan from NOW.
                    // BUT, to fix the missing bet, we MUST scan the period where it happened.
                    // For now, relies on `force_resync` script for fix, this is for ongoing.
                    // Safest: set lastIndexedBlock to currentBlock if 0 to start tracking NEW trades only,
                    // unless we want to backfill.
                    // Let's stick to: sync from last_indexed_block + 1.
                }

                const fetchFromBlock = lastIndexedBlock + 1;

                // Only query if new blocks exist
                if (currentBlock >= fetchFromBlock) {
                    const CHUNK_SIZE = 2000;
                    let totalNewVolume = BigInt(0);

                    // Forward scan from `fetchFromBlock`
                    for (let from = fetchFromBlock; from <= currentBlock; from += CHUNK_SIZE) {
                        const to = Math.min(from + CHUNK_SIZE - 1, currentBlock);
                        try {
                            const logs = await marketContract.queryFilter(
                                marketContract.filters.SharesPurchased(marketId),
                                from,
                                to
                            );
                            for (const log of logs) {
                                // args[4] is COST (totalCost in contract)
                                // args[3] is SHARES
                                // @ts-ignore
                                totalNewVolume += BigInt(log.args[4]);
                            }
                        } catch (e: any) {
                            console.error(`[Indexer] ❌ Market ${marketId} chunk ${from}-${to}:`, e.message);
                        }

                        // Rate limit
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }

                    volume += totalNewVolume;

                    if (totalNewVolume > 0n) {
                        console.log(`[Indexer] Market ${marketId} +${ethers.formatUnits(totalNewVolume, 18)} vol`);
                    }
                }

                const finalVolumeStr = ethers.formatUnits(volume, 18);

                // Get block timestamp
                const block = await provider.getBlock(currentBlock);
                const blockTimestamp = block ? new Date(block.timestamp * 1000) : new Date();

                // Insert or update market
                await query(
                    `INSERT INTO markets (market_id, question, description, image, outcome_names, prices, resolved, winning_outcome, end_time, liquidity_param, outcome_count, volume, last_indexed_at, last_indexed_block, category, created_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13, 'Uncategorized', $14)
                     ON CONFLICT (market_id) DO UPDATE 
                     SET question = EXCLUDED.question,
                         description = EXCLUDED.description,
                         image = EXCLUDED.image,
                         outcome_names = EXCLUDED.outcome_names,
                         prices = EXCLUDED.prices,
                         resolved = EXCLUDED.resolved,
                         winning_outcome = EXCLUDED.winning_outcome,
                         end_time = EXCLUDED.end_time,
                         liquidity_param = EXCLUDED.liquidity_param, 
                         outcome_count = EXCLUDED.outcome_count,
                         volume = EXCLUDED.volume,
                         last_indexed_at = NOW(),
                         last_indexed_block = $13,
                         created_at = COALESCE(markets.created_at, EXCLUDED.created_at)`,
                    [
                        marketId,
                        basicInfo.question,
                        basicInfo.description || "Imported",
                        basicInfo.image || "",
                        JSON.stringify(outcomes),
                        JSON.stringify(pricesFormatted),
                        basicInfo.resolved,
                        Number(basicInfo.winningOutcome),
                        new Date(Number(basicInfo.endTime) * 1000),
                        ethers.formatUnits(basicInfo.liquidityParam, 18),
                        Number(basicInfo.outcomeCount),
                        finalVolumeStr,
                        currentBlock,
                        blockTimestamp
                    ]
                );

            } catch (error: any) {
                console.error(`[Indexer] Failed to sync market ${marketId}:`, error.message);
            }
        }

        console.log(`[Indexer] ✅ Sync complete - ${marketIds.length} markets updated`);

    } catch (error: any) {
        console.error('[Indexer] Sync failed:', error.message);
    } finally {
        isSyncing = false;
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

    // Random startup jitter (0-10s) to prevent thundering herd if multiple instances restart
    const jitter = Math.floor(Math.random() * 10000);
    console.log(`[Indexer] Waiting ${jitter}ms before first sync...`);

    setTimeout(() => {
        if (!isSyncing) syncAllMarkets();

        // Then run periodically
        intervalId = setInterval(() => {
            if (!isSyncing) {
                syncAllMarkets();
            } else {
                console.log('[Indexer] Skipping interval, previous sync still running');
            }
        }, intervalMs);
    }, jitter);

    console.log(`[Indexer] ✅ Running`);
}

export function stopMarketIndexer(): void {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    isRunning = false;
    console.log('[Indexer] Stopped');
}
