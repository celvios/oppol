require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    const res = await pool.query("SELECT * FROM wallets WHERE public_address ILIKE '%d0a115%'");
    console.log("Results:");
    console.log(res.rows);
    await pool.end();
}

main().catch(console.error);
