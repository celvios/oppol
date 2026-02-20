
const { ethers } = require('ethers');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const ABI = [
    "event MarketCreated(uint256 indexed marketId, string question, string image, string description, string[] outcomes, uint256 liquidity)"
];

const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc.publicnode.com';
const MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || '0xe3Eb84D7e271A5C44B27578547f69C80c497355B';

async function main() {
    console.log(`Using RPC: ${RPC_URL}`);
    console.log(`Contract: ${MARKET_ADDR}`);

    // Get current block
    const response = await axios.post(RPC_URL, {
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
    });
    const currentBlock = parseInt(response.data.result, 16);
    console.log(`Current Block: ${currentBlock}`);

    // Scan backwards in chunks
    const CHUNK = 50000; // 50k blocks (QuickNode might allow large ranges for logs?)
    // Note: QuickNode logs range limits vary. 10k is safe. 50k might fail.
    // Let's try 10k to be safe.

    const iface = new ethers.Interface(ABI);
    const topic0 = iface.getEvent('MarketCreated').topicHash;
    const topic1 = ethers.zeroPadValue(ethers.toBeHex(4), 32);

    const SAFE_CHUNK = 10000;

    for (let to = currentBlock; to > 0; to -= SAFE_CHUNK) {
        const from = Math.max(0, to - SAFE_CHUNK + 1);
        console.log(`Scanning ${from} - ${to}...`);

        try {
            const res = await axios.post(RPC_URL, {
                jsonrpc: '2.0',
                method: 'eth_getLogs',
                params: [{
                    fromBlock: '0x' + BigInt(from).toString(16),
                    toBlock: '0x' + BigInt(to).toString(16),
                    address: MARKET_ADDR,
                    topics: [topic0]
                }],
                id: 1
            });

            if (res.data.error) {
                console.error('Error:', JSON.stringify(res.data.error));
                // If "query returned more than 10000 results" or range too large, reduce chunk.
                // But for MarketCreated(4), there should be only ONE event.
                // So failure is likely range limit.
                // If range limit error, retry with smaller chunk?
                // For now, scan 20M blocks then stop.
                break;
            }

            const logs = res.data.result;
            if (logs && logs.length > 0) {
                for (const log of logs) {
                    const parsed = iface.parseLog({ topics: log.topics, data: log.data });
                    const mId = parsed.args.marketId;
                    console.log(`FOUND Market ${mId} created at block ${parseInt(log.blockNumber, 16)}`);
                    if (mId.toString() === '4') {
                        console.log("!!! FOUND MARKET 4 !!!");
                        return;
                    }
                }
            }

            // Limit scanning depth 
            if (currentBlock - from > 40000000) { // 40M blocks ~ 4 years. Enough.
                console.log("Scanned 40M blocks. Giving up.");
                return;
            }

        } catch (e) {
            console.error('Request Error:', e.message);
        }

        // Small delay
        await new Promise(r => setTimeout(r, 100));
    }
}

main();
