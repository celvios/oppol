const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    await client.connect();
    const target = '0x93Edd0429c6Ac4B3644A174Ade5E9d4412E43680';

    console.log(`Checking for ${target}...`);

    // Check Web Users
    const webRes = await client.query('SELECT * FROM users WHERE wallet_address = $1', [target]);
    if (webRes.rows.length > 0) {
        console.log('FOUND IN WEB_USERS (Non-Custodial usually):');
        console.log(webRes.rows[0]);
    }

    // Check WhatsApp
    const waRes = await client.query('SELECT * FROM whatsapp_users WHERE wallet_address = $1', [target]);
    if (waRes.rows.length > 0) {
        console.log('FOUND IN WHATSAPP_USERS (Custodial):');
        console.log(waRes.rows[0]);
    }

    await client.end();
}

main().catch(console.error);
