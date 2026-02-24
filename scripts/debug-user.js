require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    const res = await pool.query("SELECT id, privy_user_id, wallet_address FROM users WHERE LOWER(wallet_address) = '0x42501490f7c291b4b28110900c9bd81f3b35b849'");
    console.log("Found user:", res.rows);
    if (res.rows.length > 0) {
        const userId = res.rows[0].id;
        console.log("fetching wallets for user_id", userId);
        const wal_res = await pool.query("SELECT id, public_address FROM wallets WHERE user_id = $1", [userId]);
        console.log("Wallets:", wal_res.rows);
    }
    await pool.end();
}

main().catch(console.error);
