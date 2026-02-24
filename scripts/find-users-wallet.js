require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    const res = await pool.query("SELECT id, privy_user_id, custodial_wallet_address FROM users WHERE custodial_wallet_address ILIKE '%d0a115%'");
    console.log("Found in users:", res.rows);
    await pool.end();
}

main().catch(console.error);
