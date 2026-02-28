require('dotenv').config({ path: '.env' });

async function run() {
    console.log('Fetching all markets to verify local API is up...');

    // We already know the Google user's SA address: 0x9Ff472aEb3A160A47E00916ce717802A511DE419
    // Since we can't query the DB directly from here, we'll hit the newly accessible endpoint
    // or just hit the production API with all known Privy IDs if needed.

    const { Pool } = require('pg');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000 // fail fast instead of hanging
    });

    try {
        console.log('Attempting DB connection...');
        const r = await pool.query('SELECT privy_user_id FROM users WHERE LOWER(wallet_address) = $1', ['0x9ff472aeb3a160a47e00916ce717802a511de419']);
        if (!r.rows.length) {
            console.log('User not found in DB');
            return;
        }

        const id = r.rows[0].privy_user_id;
        console.log('✅ Found Privy ID for Google User:', id);
        console.log('🚀 Triggering manual custodial deposit sweep on production...');

        const res = await fetch('https://oppol-dug5.onrender.com/api/wallet/deposit-custodial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ privyUserId: id })
        });

        const data = await res.json();
        console.log('\n=== API RESPONSE ===');
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error connecting to DB (likely IP blocked):', e.message);
        console.log('To fix this user, we must run the sweep from inside the production environment.');
    } finally {
        await pool.end();
    }
}

run();
