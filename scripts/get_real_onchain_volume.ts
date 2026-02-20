// @ts-nocheck
const { ethers } = require('ethers');
const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

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
                // console.warn(`RPC Error ${url}:`, response.data.error);
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

        async function worker() {
            while (chunks.length > 0) {
                const chunk = chunks.shift();
                if (!chunk) break;

                try {
                    // Fetch logs for ALL markets in this chunk (single call with topic0 only)
                    // or specific topics for 4 and 5?
                    // eth_getLogs topics: [topic0, [topic1_4, topic1_5]] is supported by some RPCs (OR filter).
                    // Let's try OR filter: [topic0, [market4_hash, market5_hash]]

                    const topic1_4 = ethers.zeroPadValue(ethers.toBeHex(4), 32);
                    const topic1_5 = ethers.zeroPadValue(ethers.toBeHex(5), 32);

                    const logs = await getLogs(chunk.from, chunk.to, CONFIG.MARKET_CONTRACT, [topic0, [topic1_4, topic1_5]]);

                    if (logs && logs.length > 0) {
                        for (const log of logs) {
                            const parsed = iface.parseLog({ topics: log.topics, data: log.data });
                            const marketId = parseInt(parsed.args.marketId);
                            const cost = parsed.args.totalCost;

                            if (results[marketId] !== undefined) {
                                results[marketId] += BigInt(cost);
                            }
                        }
                    }
                    processed++;
                    if (processed % 50 === 0) {
                        const pct = Math.round((processed / (processed + chunks.length)) * 100);
                        console.log(`Progress: ${pct}% - Chunks remaining: ${chunks.length}`);
                    }
                } catch (e) {
                    console.error(`Error chunk ${chunk.from}-${chunk.to}: ${e.message.slice(0, 50)}`);
                    chunks.push(chunk); // Retry
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }

        await Promise.all(Array(CONCURRENCY).fill(0).map(worker));

        console.log("\n---------------------------------------------------");
        console.log("FINAL RESULTS");
        console.log("---------------------------------------------------");

        for (const id of TARGET_MARKETS) {
            console.log(`Market ${id}:`);
            console.log(`  Volume (Wei): ${results[id].toString()}`);
            console.log(`  Volume (USDC): $${ethers.formatUnits(results[id], 6)}`); // DECIMAL FIX: 6-dec USDC
        }
    } catch (e) {
        console.error("Main Error:", e);
    }
}

main();
