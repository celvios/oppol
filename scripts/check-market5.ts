import { ethers } from 'ethers';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
    console.log("----------------------------------------");
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // CHECK DB
        console.log("Checking Market 5 in Database...");
        const dbRes = await client.query('SELECT volume FROM markets WHERE market_id = 5');
        if (dbRes.rows.length > 0) {
            console.log(`DB Volume: $${dbRes.rows[0].volume}`);
        } else {
            console.log("Market 5 not found in DB");
        }

        // CHECK CONTRACT
        const RPC_URL = process.env.BNB_RPC_URL || "https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/";
        const MARKET_ADDRESS = process.env.NEXT_PUBLIC_MARKET_ADDRESS || "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";

        console.log("Checking Market 5 on Contract...");
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const contract = new ethers.Contract(MARKET_ADDRESS, [
            "function getMarketShares(uint256) view returns (uint256[])"
        ], provider);

        const shares = await contract.getMarketShares(5);
        let totalShares = BigInt(0);
        shares.forEach((s: bigint) => totalShares += s);
        console.log(`Contract Total Shares (Volume): $${ethers.formatUnits(totalShares, 18)}`);

    } catch (e: any) {
        console.error("Error:", e.message);
    } finally {
        await client.end();
    }
    console.log("----------------------------------------");
}

main();
