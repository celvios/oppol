
const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        const query = "UPDATE markets SET volume = 2.934920 WHERE id = 4";
        console.log("Executing:", query);
        const res = await pool.query(query);
        console.log("Update success:", res.rowCount);
        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}

main();
