
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Manual .env loading
dotenv.config({ path: path.resolve(__dirname, '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        console.log("Updating markets.volume from trades...");

        // Calculate volume per market from trades using total_cost
        const res = await pool.query(`
            SELECT market_id, SUM(total_cost::numeric) as total_volume 
            FROM trades 
            GROUP BY market_id
        `);

        console.log(`Found ${res.rows.length} markets with trades.`);

        for (const row of res.rows) {
            const marketId = row.market_id;
            const volume = row.total_volume;

            console.log(`Market ${marketId}: Volume ${volume}`);

            // Update market
            await pool.query(`
                UPDATE markets 
                SET volume = $1 
                WHERE market_id = $2
            `, [volume, marketId]);

            console.log(`Updated Market ${marketId} volume to ${volume}`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

main();
