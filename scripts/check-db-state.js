const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkDatabase() {
    try {
        const result = await pool.query(
            'SELECT market_id, question, liquidity, volume, last_indexed_at FROM markets ORDER BY market_id LIMIT 5'
        );

        console.log('\n==DATABASE CURRENT STATE===');
        console.log('Market ID | Liquidity | Volume | Last Indexed');
        console.log('------------------------------------------------');

        for (const row of result.rows) {
            console.log(`${row.market_id} | ${row.liquidity} | ${row.volume} | ${row.last_indexed_at}`);
        }

        console.log('\n');
    } catch (error) {
        console.error('Database error:', error.message);
    } finally {
        await pool.end();
    }
}

checkDatabase();
