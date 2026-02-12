import { ethers } from 'ethers';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Use the premium RPC
const RPC_URL = "https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/";
const MARKET_ADDRESS = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MARKET_CONTRACT || process.env.MARKET_ADDRESS;

if (!RPC_URL) {
    console.error("Missing RPC_URL");
    process.exit(1);
}

if (!MARKET_ADDRESS) {
    console.error("Missing MARKET_ADDRESS");
    process.exit(1);
}

console.log(`Using RPC: ${RPC_URL}`);
console.log(`Using Market Contract: ${MARKET_ADDRESS}`);

const provider = new ethers.JsonRpcProvider(RPC_URL);

// Minimal ABI
const ABI = [
    "event SharesPurchased(uint256 indexed marketId, address indexed user, uint256 outcomeIndex, uint256 shares, uint256 cost)"
];

const contract = new ethers.Contract(MARKET_ADDRESS, ABI, provider);

async function main() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();

    try {
        const currentBlock = await provider.getBlockNumber();
        console.log(`Current Block: ${currentBlock}`);

        // Scan last 1,000,000 blocks 
        const SCAN_DEPTH = 1000000;
        const startBlock = Math.max(0, currentBlock - SCAN_DEPTH);
        const CHUNK_SIZE = 5000;

        const marketVolumes: Record<string, bigint> = {};

        console.log(`Scanning from block ${startBlock} to ${currentBlock} in chunks of ${CHUNK_SIZE}...`);

        for (let from = startBlock; from <= currentBlock; from += CHUNK_SIZE) {
            const to = Math.min(from + CHUNK_SIZE - 1, currentBlock);

            try {
                // Query all SharesPurchased events for the contract
                const logs = await contract.queryFilter(contract.filters.SharesPurchased(), from, to);

                for (const log of logs) {
                    // @ts-ignore
                    const marketId = log.args[0].toString();
                    // @ts-ignore
                    const cost = BigInt(log.args[4]);

                    if (!marketVolumes[marketId]) {
                        marketVolumes[marketId] = BigInt(0);
                    }
                    marketVolumes[marketId] += cost;
                }

                // Progress indicator
                if ((from - startBlock) % (CHUNK_SIZE * 10) === 0) {
                    const percent = Math.round(((from - startBlock) / SCAN_DEPTH) * 100);
                    process.stdout.write(`\rProgress: ${percent}% (Block ${from})`);
                }

            } catch (e: any) {
                console.error(`\nError querying blocks ${from}-${to}:`, e.message);
            }
        }

        console.log("\n---------------------------------------------------");
        console.log("UPDATING DATABASE...");
        console.log("---------------------------------------------------");

        for (const [marketId, volume] of Object.entries(marketVolumes)) {
            const volumeEth = ethers.formatUnits(volume, 18);
            console.log(`Market ${marketId}: Found volume $${volumeEth}`);

            // Update DB
            await client.query(
                'UPDATE markets SET volume = $1 WHERE market_id = $2',
                [volumeEth, marketId]
            );
            console.log(`   ✅ DB Updated for Market ${marketId}`);
        }

        console.log("---------------------------------------------------");
        console.log(`DONE`);

    } catch (error) {
        console.error("Fatal Error:", error);
    } finally {
        await client.end();
    }
}

main();
