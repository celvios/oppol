const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        const trades = await pool.query(`
            SELECT 
                market_id, 
                COUNT(*) as trade_count,
                SUM(shares) as total_shares,
                SUM(total_cost) as total_cost_usdc
            FROM trades 
            WHERE market_id IN (4, 5)
            GROUP BY market_id
            ORDER BY market_id;
        `);

        const markets = await pool.query(`
            SELECT market_id, volume 
            FROM markets 
            WHERE market_id IN (4, 5)
            ORDER BY market_id;
        `);

        console.log(JSON.stringify({
            trades: trades.rows,
            markets: markets.rows
        }, null, 2));

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
}

main();
