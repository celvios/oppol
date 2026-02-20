
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        console.log("Checking ALL trades count...");

        const count = await pool.query(`SELECT COUNT(*) FROM trades`);
        console.log(`Total rows in 'trades' table: ${count.rows[0].count}`);

        if (parseInt(count.rows[0].count) > 0) {
            console.log("Trades exist! Maybe market_id is string or specific type?");
            // Try fetching one to see structure
            const sample = await pool.query(`SELECT * FROM trades LIMIT 1`);
            console.log("Sample Trade:", sample.rows[0]);
        } else {
            console.log("Trades table is EMPTY. This explains why we can't see the history.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

main();
