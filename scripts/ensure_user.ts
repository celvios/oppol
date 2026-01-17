import { query } from '../src/config/database';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    try {
        const walletAddress = '0xd5d14fca5f5cCbb42ebeeDF702753b85a876258E';
        console.log(`Ensuring user ${walletAddress} exists...`);

        // Check if exists
        const res = await query('SELECT id FROM users WHERE LOWER(wallet_address) = $1', [walletAddress.toLowerCase()]);

        if (res.rows.length > 0) {
            console.log('✅ User already exists.');
        } else {
            console.log('Creating user...');
            await query("INSERT INTO users (phone_number, wallet_address) VALUES ($1, $2)", ['TestUser', walletAddress]);
            console.log('✅ User created.');
        }
        process.exit(0);

    } catch (e: any) {
        console.error('❌ Ensure user failed:', e.message);
        process.exit(1);
    }
}

main();
