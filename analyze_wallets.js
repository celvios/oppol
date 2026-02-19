const { Client } = require('pg');
require('dotenv').config();

async function main() {
    console.log('--- Database Analysis: Custodial Wallets ---');

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000
    });

    try {
        await client.connect();

        // 1. Total Custodial Wallets
        const walletCount = await client.query('SELECT COUNT(*) FROM wallets');
        console.log(`\nTotal Custodial Wallets (in 'wallets' table): ${walletCount.rows[0].count}`);

        // 2. Total Users
        const userCount = await client.query('SELECT COUNT(*) FROM users');
        console.log(`Total Users (in 'users' table): ${userCount.rows[0].count}`);

        // 3. Privy Users (likely social logins)
        const privyUsers = await client.query('SELECT COUNT(*) FROM users WHERE privy_user_id IS NOT NULL');
        console.log(`Users with Privy ID: ${privyUsers.rows[0].count}`);

        // 4. Users with Privy ID but NO Wallet (Potential failures)
        const orphanedUsers = await client.query(`
            SELECT u.id, u.display_name, u.privy_user_id, u.created_at 
            FROM users u 
            LEFT JOIN wallets w ON u.id = w.user_id 
            WHERE u.privy_user_id IS NOT NULL 
            AND w.id IS NULL
        `);

        console.log(`\nPotential Failed Registrations (Privy ID but No Wallet): ${orphanedUsers.rows.length}`);
        if (orphanedUsers.rows.length > 0) {
            console.log('Sample of orphaned users:');
            orphanedUsers.rows.slice(0, 5).forEach(u => {
                console.log(` - ${u.display_name} (ID: ${u.id}, Created: ${u.created_at})`);
            });
        }

    } catch (e) {
        console.error('DB Error:', e.message);
    } finally {
        await client.end();
    }
}

main();
