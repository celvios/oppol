import { query } from './src/config/database';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const targetWallet = '0x3B6a79d61523631473CF80d3845E9e6A0B11e5a4';
    console.log(`Searching for wallet: ${targetWallet}`);

    try {
        // Check whatsapp_users
        const res1 = await query('SELECT * FROM whatsapp_users WHERE LOWER(wallet_address) = LOWER($1)', [targetWallet]);
        if (res1.rows.length > 0) {
            console.log('Found in whatsapp_users:', res1.rows[0]);
            return;
        }

        // Check wallets (Privy/Google users)
        const res2 = await query('SELECT * FROM wallets WHERE LOWER(public_address) = LOWER($1)', [targetWallet]);
        if (res2.rows.length > 0) {
            console.log('Found in wallets:', res2.rows[0]);
            return;
        }

        console.log('Wallet not found in DB.');

    } catch (e) {
        console.error(e);
    }
}

main();
