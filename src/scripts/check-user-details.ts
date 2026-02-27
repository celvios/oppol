import dotenv from 'dotenv';
dotenv.config();
import { query } from '../config/database';

async function main() {
    const ids = [
        '7863da48-3f89-4d1b-a8d2-bb1fb47b417e',
        '807ade99-1081-4009-8b37-a8617da11be0',
        '7668bc11-05da-4b02-8b4b-2d97af51842c',
        '15cc45d1-26a0-43b8-8a63-7ec4f56b0fcc',
        '41d616b0-1f3d-4be5-bde4-4bc7cbbcfef3',
    ];

    const users = await query(
        `SELECT id, privy_user_id, wallet_address, created_at
         FROM users WHERE id = ANY($1::uuid[])`,
        [ids],
    );
    const wallets = await query(
        `SELECT user_id, public_address, (encrypted_private_key IS NOT NULL) AS has_key
         FROM wallets WHERE user_id = ANY($1::uuid[])`,
        [ids],
    );

    for (const u of users.rows) {
        const ws = wallets.rows.filter((w: any) => w.user_id === u.id);
        console.log('─'.repeat(60));
        console.log('id           :', u.id);
        console.log('display_name :', u.display_name);
        console.log('login_method :', u.login_method);
        console.log('privy_user_id:', u.privy_user_id);
        console.log('wallet_address:', u.wallet_address);
        console.log('created_at   :', u.created_at);
        for (const w of ws) {
            console.log('  wallet.public_address :', w.public_address, '| has_custodial_key:', w.has_key);
        }
        console.log();
    }
    process.exit(0);
}
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
