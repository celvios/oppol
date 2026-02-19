const { Client } = require('pg');
require('dotenv').config();

const TARGET_WALLET = '0x3B6a79d61523631473CF80d3845E9e6A0B11e5a4';

async function main() {
    console.log(`Checking users table for: ${TARGET_WALLET}`);

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const res = await client.query('SELECT * FROM users WHERE LOWER(wallet_address) = LOWER($1)', [TARGET_WALLET]);
        if (res.rows.length > 0) {
            console.log('Found in USERS table:', JSON.stringify(res.rows[0], null, 2));

            const userId = res.rows[0].id;
            console.log(`Checking wallets table for User ID: ${userId}`);

            const walletRes = await client.query('SELECT * FROM wallets WHERE user_id = $1', [userId]);
            if (walletRes.rows.length > 0) {
                console.log('User HAS a backend wallet:', JSON.stringify(walletRes.rows[0], null, 2));
            } else {
                console.log('User has NO backend wallet entry.');
            }
        } else {
            console.log('Not found in USERS table.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

main();
