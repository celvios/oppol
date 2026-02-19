const { Client } = require('pg');
require('dotenv').config();

async function main() {
    console.log('--- Custodial Wallets List ---');

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000
    });

    try {
        await client.connect();

        // Try to select email if it exists, otherwise fallback
        let query = `
            SELECT 
                w.public_address, 
                u.display_name, 
                u.privy_user_id, 
                w.created_at
            FROM wallets w
            JOIN users u ON w.user_id = u.id
            ORDER BY w.created_at DESC
        `;

        // Check if email column exists
        try {
            await client.query('SELECT email FROM users LIMIT 1');
            // If success, include email
            query = `
                SELECT 
                    w.public_address, 
                    u.display_name, 
                    u.email,
                    u.privy_user_id, 
                    w.created_at
                FROM wallets w
                JOIN users u ON w.user_id = u.id
                ORDER BY w.created_at DESC
            `;
        } catch (e) {
            console.log('NOTE: "email" column does not exist in users table. Using display_name.');
        }

        const res = await client.query(query);

        console.table(res.rows.map(r => ({
            Address: r.public_address,
            Name: r.display_name,
            Email: r.email || '(Not Stored)', // Will be undefined if col missing
            PrivyID: r.privy_user_id,
            Created: r.created_at ? r.created_at.toISOString().split('T')[0] : 'N/A'
        })));

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

main();
