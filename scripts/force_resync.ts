
import { syncAllMarkets } from '../src/services/marketIndexer';
import { query } from '../src/config/database';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    console.log("Forcing resync for Market 2...");

    try {
        // 1. Reset Market 2 state
        await query(
            "UPDATE markets SET last_indexed_block = 0, volume = '0' WHERE market_id = 2"
        );
        console.log("Market 2 DB state reset.");

        // 2. Run Sync
        console.log("Running syncAllMarkets()...");
        await syncAllMarkets();

        // 3. Verify
        const res = await query("SELECT * FROM markets WHERE market_id = 2");
        if (res.rows.length > 0) {
            const m = res.rows[0];
            console.log(`Market 2 Synced State:`);
            console.log(`- Volume: ${m.volume}`);
            console.log(`- Last Block: ${m.last_indexed_block}`);
            console.log(`- Question: ${m.question}`);
        } else {
            console.error("Market 2 not found in DB after sync!");
        }

    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

main();
