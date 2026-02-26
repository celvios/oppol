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

        // Find the globally latest indexed block across ALL markets
        const globalStateRes = await query('SELECT MAX(last_indexed_block) as min_block FROM markets');
        let globalLastBlock = globalStateRes.rows[0]?.min_block ? parseInt(globalStateRes.rows[0].min_block) : 0;

        const DEPLOYMENT_BLOCK = parseInt(process.env.MARKET_DEPLOYMENT_BLOCK || '0');
        if (globalLastBlock === 0) {
            globalLastBlock = DEPLOYMENT_BLOCK > 0 ? DEPLOYMENT_BLOCK : Math.max(0, currentBlock - 10000);
        }

        const fetchFromBlock = globalLastBlock + 1;

        // 1. GLOBALLY fetch all SharesPurchased events in ONE call, drastically saving RPC Compute Units
        const allNewTrades: any[] = [];
        if (currentBlock >= fetchFromBlock) {
            const CHUNK_SIZE = 4000;
            console.log(`[Indexer] Fetching global events from block ${fetchFromBlock} to ${currentBlock}...`);

            for (let from = fetchFromBlock; from <= currentBlock; from += CHUNK_SIZE) {
                const to = Math.min(from + CHUNK_SIZE - 1, currentBlock);
                try {
                    // Query WITHOUT filtering by marketId -> gets ALL markets at once
                    const logs = await marketContract.queryFilter(
                        marketContract.filters.SharesPurchased(),
                        from,
                        to
                    );
                    allNewTrades.push(...logs);
                } catch (e: any) {
                    console.error(`[Indexer] ❌ Global chunk ${from}-${to} failed:`, e.message);
                }
                await new Promise(r => setTimeout(r, 200)); // Rate limit
            }
            console.log(`[Indexer] Found ${allNewTrades.length} new trades globally.`);
        }

        // Group trades by marketId
        const tradesByMarket: Record<number, any[]> = {};
        for (const log of allNewTrades) {
            const marketId = Number(log.args.marketId);
            if (!tradesByMarket[marketId]) tradesByMarket[marketId] = [];
            tradesByMarket[marketId].push(log);
        }

        // 2. Decode responses and update database
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
                    'SELECT volume FROM markets WHERE market_id = $1',
                    [marketId]
                );

                if (dbMarket.rows.length > 0) {
                    const row = dbMarket.rows[0];
                    volume = row.volume ? ethers.parseUnits(row.volume, 18) : BigInt(0);
                }

                // Process new trades for THIS market
                const marketTrades = tradesByMarket[marketId] || [];
                let totalNewVolume = BigInt(0);

                for (const log of marketTrades) {
                    // @ts-ignore
                    const [marketIdArg, user, outcomeIndex, shares, cost] = log.args;
                    const txHash = log.transactionHash;

                    totalNewVolume += BigInt(cost);

                    // Insert trade record
                    try {
                        await query(`
                            INSERT INTO trades (
                                market_id, user_address, outcome_index, shares, total_cost, tx_hash, created_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
                            ON CONFLICT (tx_hash) DO NOTHING
                        `, [
                            marketId,
                            user,
                            Number(outcomeIndex),
                            ethers.formatUnits(shares, 18),
                            ethers.formatUnits(cost, 18),
                            txHash
                        ]);

                        // ====== 🔍 DIAGNOSTIC LOG: Issue 2 - Trade Written to DB ======
                        console.log('🔍 [Indexer] [ISSUE-2] Trade inserted into DB:', {
                            txHash,
                            marketId,
                            user_address: user,
                            outcomeIndex: Number(outcomeIndex),
                            shares: ethers.formatUnits(shares, 18),
                            cost: ethers.formatUnits(cost, 18),
                            NOTE: 'Portfolio query uses LOWER(user_address). Ensure this matches the address in /api/portfolio/:address',
                        });
                        // ============================================================

                    } catch (err: any) {
                        console.error(`[Indexer] Failed to insert trade ${txHash}:`, err.message);
                    }
                }

                volume += totalNewVolume;

                if (totalNewVolume > 0n) {
                    console.log(`[Indexer] Market ${marketId} +${ethers.formatUnits(totalNewVolume, 18)} vol`);
                }

                // totalCost events are 18-decimal (LMSR calculateCost output)
                const finalVolumeStr = ethers.formatUnits(volume, 18);

                // Get block timestamp
                const blockTimestamp = new Date(); // Use current time for indexing timestamp

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
                        ethers.formatUnits(basicInfo.liquidityParam, 6), // DECIMAL FIX: liquidityParam is 6-dec USDC
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
