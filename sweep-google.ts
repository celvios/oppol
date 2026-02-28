import { query } from './src/config/db';

async function run() {
    try {
        const r = await query('SELECT privy_user_id FROM users WHERE LOWER(wallet_address) = $1', ['0x9ff472aeb3a160a47e00916ce717802a511de419']);
        if (!r.rows.length) {
            console.log('User not found in DB');
            process.exit(0);
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
        console.error('Error:', e);
    }
    process.exit(0);
}

run();
