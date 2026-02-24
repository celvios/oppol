require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    const res = await pool.query("SELECT * FROM whatsapp_users WHERE LOWER(wallet_address) LIKE '%d0a115%'");
    console.log("WhatsApp Users:", res.rows);
    await pool.end();
}

main().catch(console.error);
