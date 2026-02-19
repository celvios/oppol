const { Client } = require('pg');
require('dotenv').config();

const targetWallet = '0x3B6a79d61523631473CF80d3845E9e6A0B11e5a4';

async function main() {
    console.log(`Searching for wallet: ${targetWallet}`);

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // Check whatsapp_users
        const res1 = await client.query('SELECT * FROM whatsapp_users WHERE LOWER(wallet_address) = LOWER($1)', [targetWallet]);
        if (res1.rows.length > 0) {
            console.log('Found in whatsapp_users:', JSON.stringify(res1.rows[0], null, 2));
            return;
        }

        // Check wallets
        const res2 = await client.query('SELECT * FROM wallets WHERE LOWER(public_address) = LOWER($1)', [targetWallet]);
        if (res2.rows.length > 0) {
            console.log('Found in wallets:', JSON.stringify(res2.rows[0], null, 2));
            return;
        }

        // Check telegram_users
        const res3 = await client.query('SELECT * FROM telegram_users WHERE LOWER(wallet_address) = LOWER($1)', [targetWallet]);
        if (res3.rows.length > 0) {
            console.log('Found in telegram_users:', JSON.stringify(res3.rows[0], null, 2));
            return;
        }

        console.log('Wallet not found in DB.');


    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

main();
