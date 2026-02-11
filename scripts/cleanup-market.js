
const { Pool } = require('pg');
require('dotenv').config();

async function main() {
    const MARKET_ID = 999999;

    // Connect to DB
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    console.log(`[Cleanup] 🧹 Removing Test Market #${MARKET_ID}...`);

    try {
        await pool.query('DELETE FROM markets WHERE market_id = $1', [MARKET_ID]);
        console.log(`[Cleanup] ✅ Test Market #${MARKET_ID} deleted.`);
    } catch (error) {
        console.error('[Cleanup] ❌ Error:', error);
    } finally {
        await pool.end();
    }
}

main();
