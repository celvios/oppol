import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { ethers } from 'ethers';

// Load env from root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
    console.log("🔍 DIAGNOSTIC: Backend Environment & Database");
    console.log("------------------------------------------------");

    // 1. Check Env Vars
    const MARKET_ADDR = process.env.MARKET_CONTRACT;
    const USDC_ADDR = process.env.USDC_CONTRACT || process.env.USDC_ADDRESS;

    console.log("ENV: MARKET_CONTRACT:", MARKET_ADDR);
    console.log("ENV: USDC_CONTRACT:  ", USDC_ADDR);

    if (MARKET_ADDR !== "0xe3Eb84D7e271A5C44B27578547f69C80c497355B") {
        console.warn("⚠️  WARNING: MARKET_CONTRACT is NOT the one with funds (0xe3Eb...)!");
    } else {
        console.log("✅  MARKET_CONTRACT matches the funded contract.");
    }

    // 2. Check Database Trades
    console.log("\n🔍 Checking Database Trades...");
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // Sum Volume
        const volRes = await client.query('SELECT SUM(total_cost) as volume FROM trades');
        const vol = volRes.rows[0]?.volume || '0';
        console.log(`DB: Total Volume (SUM trades): $${vol}`);

        if (Number(vol) === 0) {
            console.warn("⚠️  DB Volume is 0. Indexer has NOT picked up the user's bets yet.");
        }

        // Check Market #12
        const mktRes = await client.query('SELECT * FROM markets WHERE market_id = 12');
        if (mktRes.rows.length > 0) {
            const m = mktRes.rows[0];
            console.log(`\nDB: Market #12 Found:`);
            console.log(`  Question: "${m.question}"`);
            console.log(`  Ends At:  ${m.end_time}`);
            console.log(`  Resolved: ${m.resolved}`);
        } else {
            console.warn("\n⚠️  DB: Market #12 NOT found in database!");
        }

    } catch (e: any) {
        console.error("DB Error:", e.message);
    } finally {
        await client.end();
    }
}

main();
