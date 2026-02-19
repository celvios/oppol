const { Client } = require('pg');
require('dotenv').config();

async function main() {
    console.log('--- Custodial Wallets List (Simplified) ---');

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 30000,
        keepAlive: true
    });

    try {
        await client.connect();

        const query = `
            SELECT 
                w.public_address, 
                u.display_name, 
                u.privy_user_id, 
                w.created_at
            FROM wallets w
            JOIN users u ON w.user_id = u.id
            ORDER BY w.created_at DESC
        `;

        const res = await client.query(query);

        if (res.rows.length === 0) {
            console.log("No custodial wallets found.");
        } else {
            console.log(JSON.stringify(res.rows, null, 2));
        }

    } catch (e) {
        console.error("DB Error:", e.message);
    } finally {
        await client.end();
    }
}

main();
