
import { query } from './src/config/database';

async function checkAlan() {
    console.log("Checking for user 'alan'...");

    try {
        const res = await query(`
            SELECT id, display_name, wallet_address, privy_user_id, created_at 
            FROM users 
            WHERE display_name ILIKE '%alan%'
        `);

        if (res.rows.length === 0) {
            console.log("❌ No user found matching 'alan'.");
        } else {
            res.rows.forEach(u => {
                console.log("--------------------------------------------------");
                console.log(`User: ${u.display_name} (${u.username || 'No Username'})`);
                console.log(`ID: ${u.id}`);
                console.log(`Wallet: ${u.wallet_address || '❌ MISSING'}`);
                console.log(`Privy ID: ${u.privy_user_id || '❌ MISSING'}`);
                console.log(`Created: ${u.created_at}`);

                if (u.wallet_address && u.privy_user_id) {
                    console.log("✅ STATUS: SYNCED");
                } else {
                    console.log("⚠️ STATUS: INCOMPLETE");
                }
            });
        }
    } catch (err) {
        console.error("Error:", err);
    }
}

checkAlan();
