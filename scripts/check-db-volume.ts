
import pool from '../src/config/database';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
    try {
        console.log("Checking database volume...");
        const res = await pool.query('SELECT SUM(volume::numeric) as total_volume FROM markets');
        console.log(`Total Volume from DB: $${res.rows[0].total_volume}`);

        const res2 = await pool.query('SELECT market_id, volume FROM markets ORDER BY volume::numeric DESC LIMIT 10');
        console.log("Top 10 Markets by Volume:");
        res2.rows.forEach(r => {
            console.log(`Market ${r.market_id}: $${r.volume}`);
        });

    } catch (error) {
        console.error("Error querying DB:", error);
    } finally {
        await pool.end();
    }
}

main();
