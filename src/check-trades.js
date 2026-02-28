require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    try {
        const res = await pool.query('SELECT * FROM trades ORDER BY created_at DESC LIMIT 5');
        console.log('--- LATEST TRADES ---');
        console.log(res.rows);
    } catch (e) {
        console.error('DB Error:', e);
    } finally {
        pool.end();
    }
}
run();
