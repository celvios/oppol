const { Client } = require('pg');
require('dotenv').config();

const TARGET_WALLET = '0x3B6a79d61523631473CF80d3845E9e6A0B11e5a4';

async function main() {
    console.log(`Checking users table for: ${TARGET_WALLET}`);

    // Attempt local connection if remote fails or use simplified config
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000 // 5s timeout
    });

    try {
        await client.connect();

        const res = await client.query('SELECT id, wallet_address, display_name FROM users WHERE LOWER(wallet_address) = LOWER($1)', [TARGET_WALLET]);
        if (res.rows.length > 0) {
            console.log('Found in USERS table:', JSON.stringify(res.rows[0], null, 2));
        } else {
            console.log('Not found in USERS table.');
        }

    } catch (e) {
        console.error('DB Error:', e.message);
    } finally {
        await client.end();
    }
}

main();
