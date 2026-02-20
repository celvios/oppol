
// @ts-nocheck
const { ethers } = require('ethers');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const axios = require('axios');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

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

async function callRpc(method, params) {
    let lastError;
    for (const url of RPC_URLS) {
        try {
            const response = await axios.post(url, {
                jsonrpc: '2.0',
                method,
                params,
                id: 1
            }, { timeout: 10000 });

            if (response.data.error) {
                // If rate limited, throw to try next
                throw new Error(JSON.stringify(response.data.error));
            }
            return response.data.result;
        } catch (e) {
            lastError = e;
            // Try next RPC
        }
    }
    throw lastError;
}

async function main() {
    try {
        console.log("Starting backfill (Reverse Scan)...");

        // Get current block
        const currentBlockHex = await callRpc('eth_blockNumber', []);
        const currentBlock = parseInt(currentBlockHex, 16);
        console.log(`[Backfill] Current block: ${currentBlock}`);

        // Market 4 creation block
        const START_BLOCK = 76912895;

        // Settings
        const CONCURRENCY = 5;
        const CHUNK_SIZE = 500;

        // Topics
        const eventFragment = iface.getEvent('SharesPurchased');
        const topic0 = eventFragment.topicHash;
        const topic1 = ethers.zeroPadValue(ethers.toBeHex(4), 32);

        // Generate ranges
        const ranges = [];
        console.log(`[Backfill] Strategy: Scanning BACKWARDS from ${currentBlock} to ${START_BLOCK}...`);

        for (let from = START_BLOCK; from <= currentBlock; from += CHUNK_SIZE) {
            const to = Math.min(from + CHUNK_SIZE - 1, currentBlock);
            ranges.push({ from, to });
        }
        ranges.reverse(); // Process most recent first!

        console.log(`[Backfill] Total chunks: ${ranges.length}`);

        let currentIndex = 0;
        let totalLogsFound = 0;
        let processedChunks = 0;

        async function worker(id) {
            while (currentIndex < ranges.length) {
                const index = currentIndex++;
                const { from, to } = ranges[index];

                let success = false;
                let attempts = 0;

                while (!success && attempts < 3) {
                    try {
                        const logs = await callRpc('eth_getLogs', [{
                            fromBlock: '0x' + BigInt(from).toString(16),
                            toBlock: '0x' + BigInt(to).toString(16),
                            address: CONFIG.MARKET_CONTRACT,
                            topics: [topic0, topic1]
                        }]);

                        success = true;

                        if (logs && logs.length > 0) {
                            console.log(`[Worker ${id}] Found ${logs.length} logs in ${from}-${to}`);
                            for (const log of logs) {
                                await processLog(log);
                                totalLogsFound++;
                            }
                        }
                    } catch (e) {
                        attempts++;
                        console.error(`[Worker ${id}] Chunk ${from}-${to} failed attempt ${attempts}: ${e.message.slice(0, 100)}...`);
                        await new Promise(r => setTimeout(r, 2000 * attempts));
                    }
                }

                processedChunks++;
                if (processedChunks % 50 === 0) {
                    console.log(`[Progress] Processed ${processedChunks}/${ranges.length} chunks. Found ${totalLogsFound} trades.`);
                }
            }
        }

        await Promise.all(Array(CONCURRENCY).fill(0).map((_, i) => worker(i)));

        console.log(`[Backfill] Complete! Found ${totalLogsFound} total trades.`);
        process.exit(0);

    } catch (e) {
        console.error("Fatal error:", e);
        process.exit(1);
    }
}

async function processLog(log) {
    try {
        const parsed = iface.parseLog({ topics: log.topics, data: log.data });
        const { marketId, user, outcomeIndex, shares, totalCost } = parsed.args;

        const txHash = log.transactionHash;

        // Insert into DB
        // shares and totalCost are BigInts (wei)
        const sharesNum = ethers.formatUnits(shares, 18);
        const costUSDC = ethers.formatUnits(totalCost, 18);

        // Map outcomeIndex to side
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
            txHash
        ]);

    } catch (e) {
        console.error(`Error processing log ${log.transactionHash}:`, e.message);
    }
}

main();
