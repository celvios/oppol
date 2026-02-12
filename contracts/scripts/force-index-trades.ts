import { ethers } from "hardhat";
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MARKET_ADDRS = [
    { name: "REAL (0xe3Eb)", addr: "0xe3Eb84D7e271A5C44B27578547f69C80c497355B" },
    { name: "LATEST V2 (0xB6a2)", addr: "0xB6a211822649a61163b94cf46e6fCE46119D3E1b" },
    { name: "OLD (0xf91D)", addr: "0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6" },
    { name: "FALLBACK/TEST (0xA7DE)", addr: "0xA7DEd30e8A292dAA8e75A8d288393f8e290f9717" }
];
const RPC_URL = process.env.BNB_RPC_URL || "https://bsc-dataseed.binance.org/";

const MARKET_ABI = [
    "event SharesPurchased(uint256 indexed marketId, address indexed user, uint256 outcomeIndex, uint256 shares, uint256 cost)",
    "function getMarketBasicInfo(uint256) view returns (string, string, string, uint256, uint256, uint256, bool, uint256)"
];

async function main() {
    console.log("🔍 FORCE INDEXER: Scanning ALL Contracts...");
    console.log("RPC:", RPC_URL);

    // 1. Setup Provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // 2. Setup DB
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();

    try {
        // 3. Scan last 5000 blocks (~4h) in chunks
        const currentBlock = await provider.getBlockNumber();
        const startBlock = currentBlock - 5000;
        console.log(`Scanning blocks ${startBlock} to ${currentBlock}...`);

        for (const { name, addr } of MARKET_ADDRS) {
            console.log(`\n-----------------------------------`);
            console.log(`🔍 Scanning ${name}: ${addr}`);
            const contract = new ethers.Contract(addr, MARKET_ABI, provider);
            const CHUNK_SIZE = 2000;
            const filter = contract.filters.SharesPurchased();

            let allLogs: any[] = [];

            for (let i = startBlock; i < currentBlock; i += CHUNK_SIZE) {
                const to = Math.min(i + CHUNK_SIZE - 1, currentBlock);
                process.stdout.write(`.`); // Progress dots
                try {
                    const logs = await contract.queryFilter(filter, i, to);
                    allLogs = [...allLogs, ...logs];
                    await new Promise(r => setTimeout(r, 100)); // Tiny delay
                } catch (e: any) {
                    console.error(`\nError scanning chunk ${i}-${to}: ${e.message}`);
                }
            }
            console.log(`\nFound ${allLogs.length} events on ${name}`);

            for (const log of allLogs) {
                // @ts-ignore
                const { marketId, user, outcomeIndex, shares, cost } = log.args;
                const txHash = log.transactionHash;

                // Calculate implied pricePerShare
                const costBN = BigInt(cost);
                const sharesBN = BigInt(shares);
                let pricePerShare = BigInt(0);
                if (sharesBN > BigInt(0)) {
                    pricePerShare = (costBN * BigInt(1e18)) / sharesBN;
                }

                console.log(`  > Found Trade: Market ${marketId}, Cost $${ethers.formatUnits(cost, 18)}`);

                if (name.includes("REAL")) {
                    // Only insert for REAL contract to verify DB
                    const costFormatted = ethers.formatUnits(cost, 18);
                    const sharesFormatted = ethers.formatUnits(shares, 18);
                    const priceFormatted = ethers.formatUnits(pricePerShare, 18);
                    const side = Number(outcomeIndex) === 0 ? 'YES' : 'NO';

                    const check = await client.query('SELECT id FROM trades WHERE tx_hash = $1', [txHash]);
                    if (check.rows.length === 0) {
                        await client.query(`
                            INSERT INTO trades (
                                market_id, user_address, side, shares, price_per_share, total_cost, tx_hash
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                         `, [
                            Number(marketId),
                            user,
                            side,
                            sharesFormatted,
                            priceFormatted,
                            costFormatted,
                            txHash
                        ]);
                        console.log("    ✅ Inserted into DB");
                    } else {
                        console.log("    ⚠️  Already indexed");
                    }
                } else {
                    console.warn(`    ⚠️  Trade found on WRONG contract (${name})! Not indexing.`);
                }
            }
        }

        // Final DB Update
        if (MARKET_ADDRS.length > 0) { // Always run update
            try {
                await client.query(`
                    UPDATE markets m
                    SET volume = (SELECT SUM(total_cost) FROM trades t WHERE t.market_id = m.market_id)
                    WHERE m.market_id IN (SELECT DISTINCT market_id FROM trades)
                `);
                console.log("\n✅ Updated Aggregated Volume in Markets table");
            } catch (e: any) {
                console.error("DB Update Error", e.message);
            }
        }

    } catch (e: any) {
        console.error("Error:", e.message);
    } finally {
        await client.end();
    }
}

main();
