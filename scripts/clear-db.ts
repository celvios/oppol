
import pool from '../src/config/database';
import dotenv from 'dotenv';
dotenv.config();

async function clearTables() {
    try {
        console.log('🗑️ Clearing telegram_users and whatsapp_users tables...');
        await pool.query('TRUNCATE TABLE telegram_users, whatsapp_users CASCADE;');
        console.log('✅ Tables cleared successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to clear tables:', error);
        process.exit(1);
    }
}

clearTables();
