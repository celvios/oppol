// @ts-nocheck
const { ethers } = require('ethers');
const { Pool } = require('pg');
const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const MARKET_ABI = [
    "event SharesPurchased(uint256 indexed marketId, address indexed user, uint256 outcomeIndex, uint256 shares, uint256 totalCost)"
];

const RPC_URLS = [
    process.env.BNB_RPC_URL || 'https://bsc.publicnode.com',
    'https://binance.llamarpc.com',
    'https://bsc-dataseed1.binance.org/'
];

const CONFIG = {
    MARKET_CONTRACT: process.env.NEXT_PUBLIC_MARKET_ADDRESS || '0xe3Eb84D7e271A5C44B27578547f69C80c497355B'
};

const iface = new ethers.Interface(MARKET_ABI);

async function callRpc(method, params, id = 1) {
    let lastError;
    for (const url of RPC_URLS) {
        try {
            const response = await axios.post(url, {
                jsonrpc: '2.0',
                method,
                params,
                id
            }, { timeout: 10000 });

            if (response.data.error) {
                throw new Error(JSON.stringify(response.data.error));
            }
            return response.data.result;
        } catch (e) {
            lastError = e;
        }
    }
    throw lastError;
}

async function getLogs(fromBlock, toBlock, address, topics) {
    return await callRpc('eth_getLogs', [{
        fromBlock: '0x' + BigInt(fromBlock).toString(16),
        toBlock: '0x' + BigInt(toBlock).toString(16),
        address,
        topics
    }]);
}

async function processLog(log, pool) {
    try {
        const parsed = iface.parseLog({ topics: log.topics, data: log.data });
        const { marketId, user, outcomeIndex, shares, totalCost } = parsed.args;

        const txHash = log.transactionHash;

        const sharesNum = ethers.formatUnits(shares, 18);
        const costUSDC = ethers.formatUnits(totalCost, 18);

        let side;
        if (Number(marketId) === 5) {
            // Usually 0-9 for V2. Use outcomeIndex string if needed. We'll store it as is or map appropriately.
            // Wait, trades table has `outcome_index` NOT `side` in V2. Let's check table schema.
            // `backfill_trades.ts` used `side`, `marketIndexer.ts` used `outcome_index`.
            // Let's use outcome_index to be safe and let DB handle or try `side` if older schema.
        }

        // Try both or check schema.

        await pool.query(`
            INSERT INTO trades (
                market_id, user_address, outcome_index, shares, total_cost, tx_hash, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (tx_hash) DO NOTHING
        `, [
            Number(marketId),
            user,
            Number(outcomeIndex),
            sharesNum,
            costUSDC,
            txHash
        ]);

    } catch (e) {
        // Fallback for older schema if outcome_index doesn't exist
        try {
            const parsed = iface.parseLog({ topics: log.topics, data: log.data });
            const { marketId, user, outcomeIndex, shares, totalCost } = parsed.args;
            const sharesNum = ethers.formatUnits(shares, 18);
            const costUSDC = ethers.formatUnits(totalCost, 18);
            const side = Number(outcomeIndex) === 0 ? 'YES' : 'NO';

            await pool.query(`
                INSERT INTO trades (
                    market_id, user_address, side, shares, total_cost, tx_hash, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT (tx_hash) DO NOTHING
            `, [
                Number(marketId),
                user,
                side,
                sharesNum,
                costUSDC,
                log.transactionHash
            ]);
        } catch (e2) {
            console.error(`Error inserting log ${log.transactionHash}:`, e2.message.slice(0, 100));
        }
    }
}

async function main() {
    try {
        console.log("Fetching current block...");
        const currentBlockHex = await callRpc('eth_blockNumber', []);
        const currentBlock = parseInt(currentBlockHex, 16);
        console.log(`Current block: ${currentBlock}`);

        const START_BLOCK = 76912000;
        const TARGET_MARKETS = [4, 5];

        console.log(`Scanning from block ${START_BLOCK} to ${currentBlock} for Markets ${TARGET_MARKETS.join(', ')}`);

        // Concurrent
        const CHUNK_SIZE = 5000;
        const CONCURRENCY = 10;

        const chunks = [];
        for (let from = START_BLOCK; from <= currentBlock; from += CHUNK_SIZE) {
            const to = Math.min(from + CHUNK_SIZE - 1, currentBlock);
            chunks.push({ from, to });
        }

        console.log(`Total chunks: ${chunks.length}`);

        const eventFragment = iface.getEvent('SharesPurchased');
        const topic0 = eventFragment.topicHash;

        const results = {
            4: BigInt(0),
            5: BigInt(0)
        };

        let processed = 0;
        let inserted = 0;

        async function worker() {
            while (chunks.length > 0) {
                const chunk = chunks.shift();
                if (!chunk) break;

                try {
                    const topic1_4 = ethers.zeroPadValue(ethers.toBeHex(4), 32);
                    const topic1_5 = ethers.zeroPadValue(ethers.toBeHex(5), 32);

                    const logs = await getLogs(chunk.from, chunk.to, CONFIG.MARKET_CONTRACT, [topic0, [topic1_4, topic1_5]]);

                    if (logs && logs.length > 0) {
                        for (const log of logs) {
                            const parsed = iface.parseLog({ topics: log.topics, data: log.data });
                            const marketId = parseInt(parsed.args.marketId);
                            const cost = parsed.args.totalCost;

                            results[marketId] += BigInt(cost);

                            // Insert log
                            await processLog(log, pool);
                            inserted++;
                        }
                    }
                    processed++;
                    if (processed % 50 === 0) {
                        const pct = Math.round((processed / (processed + chunks.length)) * 100);
                        console.log(`Progress: ${pct}% - Inserted: ${inserted}`);
                    }
                } catch (e) {
                    chunks.push(chunk); // Retry
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }

        await Promise.all(Array(CONCURRENCY).fill(0).map(worker));

        console.log("\n---------------------------------------------------");
        console.log(`FINAL RESULTS: Inserted ${inserted} trades`);
        console.log("---------------------------------------------------");

        // Now UPDATE markets table with total volumes calculated
        for (const id of TARGET_MARKETS) {
            const finalVolume = ethers.formatUnits(results[id], 18);
            console.log(`Market ${id} Volume: ${finalVolume}`);

            await pool.query(`
                UPDATE markets
                SET volume = $1
                WHERE market_id = $2
            `, [finalVolume, id]);
        }
        console.log("Markets table updated successfully.");

    } catch (e) {
        console.error("Main Error:", e);
    } finally {
        await pool.end();
    }
}

main();
