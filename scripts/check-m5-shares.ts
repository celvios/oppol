import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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

const provider = new ethers.JsonRpcProvider(RPC_URL);

const ABI = [
    "function getMarketShares(uint256) view returns (uint256[])",
    "function getMarketBasicInfo(uint256) view returns (string, string, string, uint256, uint256, uint256, bool, uint256)"
];

const contract = new ethers.Contract(MARKET_ADDRESS, ABI, provider);

async function main() {
    try {
        const marketId = 5;
        console.log(`Checking Market ${marketId}...`);

        const shares = await contract.getMarketShares(marketId);
        console.log("Shares per outcome:");
        let totalShares = BigInt(0);
        shares.forEach((s: bigint, i: number) => {
            console.log(`  Outcome ${i}: ${ethers.formatUnits(s, 18)}`);
            totalShares += s;
        });

        console.log(`\nTotal Shares Sum: ${ethers.formatUnits(totalShares, 18)}`);

        // Also check DB for comparison
        const { Client } = require('pg');
        const client = new Client({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
        await client.connect();

        const res = await client.query('SELECT volume FROM markets WHERE market_id = $1', [marketId]);
        if (res.rows.length > 0) {
            console.log(`DB Volume (Cost): $${res.rows[0].volume}`);
        }

        await client.end();

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
