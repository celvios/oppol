import { query } from '../src/config/database';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    try {
        console.log('Patching users table...');
        await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(42)");
        console.log('✅ Patched users table: Added wallet_address column if missing.');
        process.exit(0);
    } catch (e: any) {
        console.error('❌ Patch failed:', e.message);
        process.exit(1);
    }
}

main();
