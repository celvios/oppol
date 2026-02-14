
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkPrices() {
    try {
        const res = await (pool as any).query('SELECT market_id, question, prices FROM markets ORDER BY market_id DESC LIMIT 5');
        console.log("Checking DB Prices:");
        res.rows.forEach((row: any) => {
            console.log(`Market ${row.market_id}: ${row.question.substring(0, 20)}... | Prices: ${row.prices} (${typeof row.prices})`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

checkPrices();
