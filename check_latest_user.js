const { Client } = require('pg');
require('dotenv').config();

async function main() {
    console.log('--- Checking Latest User ---');

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000
    });

    try {
        await client.connect();

        const query = `
            SELECT 
                u.id,
                u.display_name, 
                u.privy_user_id, 
                u.created_at as user_created,
                w.public_address as wallet_address,
                w.created_at as wallet_created
            FROM users u
            LEFT JOIN wallets w ON u.id = w.user_id
            ORDER BY u.created_at DESC
            LIMIT 1
        `;

        const res = await client.query(query);

        if (res.rows.length === 0) {
            console.log("No users found.");
        } else {
            console.log(JSON.stringify(res.rows[0], null, 2));
        }

    } catch (e) {
        console.error("DB Error:", e.message);
    } finally {
        await client.end();
    }
}

main();
