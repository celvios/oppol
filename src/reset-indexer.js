require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    try {
        const res = await pool.query('UPDATE markets SET last_indexed_block = 0;');
        console.log('RESET BLOCKS. Affected rows:', res.rowCount);
        const checkTrades = await pool.query('SELECT COUNT(*) FROM trades;');
        console.log('TRADES COUNT:', checkTrades.rows[0].count);
    } catch (e) {
        console.error('DB Error:', e);
    } finally {
        pool.end();
    }
}
run();
