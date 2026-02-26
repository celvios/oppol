import { query } from './src/config/database';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkDb() {
    try {
        console.log("--- RECENT TRADES ---");
        const trades = await query('SELECT * FROM trades ORDER BY created_at DESC LIMIT 5');
        console.log(trades.rows);

        console.log("\n--- MARKET 1 STATE ---");
        const markets = await query('SELECT market_id, volume, last_indexed_block FROM markets WHERE market_id = 1');
        console.log(markets.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
checkDb();
