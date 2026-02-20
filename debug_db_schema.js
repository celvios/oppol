
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        const res = await pool.query("SELECT * FROM wallets LIMIT 1");
        if (res.rows.length === 0) {
            console.log("EMPTY_TABLE");
        } else {
            console.log("COLUMNS: " + JSON.stringify(Object.keys(res.rows[0])));
        }
    } catch (e) {
        console.error("ERROR:", e);
    } finally {
        pool.end();
    }
}

main();
