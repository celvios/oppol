require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    const users = await pool.query("SELECT * FROM users LIMIT 5");
    console.log("Users:", users.rows.map(u => ({ id: u.id, privy_user_id: u.privy_user_id, wallet: u.wallet_address })));

    const wallets = await pool.query("SELECT * FROM wallets LIMIT 5");
    console.log("Wallets:", wallets.rows.map(w => ({ id: w.id, user_id: w.user_id, public_address: w.public_address })));

    // Check if d0a115 is anywhere
    const d0a115_wallets = await pool.query("SELECT * FROM wallets WHERE LOWER(public_address) LIKE '%d0a115%'");
    console.log("d0a115 in wallets:", d0a115_wallets.rows);

    const d0a115_users = await pool.query("SELECT * FROM users WHERE LOWER(wallet_address) LIKE '%d0a115%'");
    console.log("d0a115 in users:", d0a115_users.rows);

    await pool.end();
}

main().catch(console.error);
