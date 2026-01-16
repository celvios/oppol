
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function seedUsers() {
    try {
        console.log('Seeding database...');

        // Insert Mock WhatsApp User
        await pool.query(`
        INSERT INTO whatsapp_users (phone_number, wallet_address, encrypted_private_key, is_verified, created_at)
        VALUES (
            '1234567890', 
            '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', 
            'mock_key', 
            true, 
            NOW()
        )
        ON CONFLICT (phone_number) DO NOTHING;
    `);
        console.log('Added Mock WhatsApp User');

        // Insert Mock Telegram User
        await pool.query(`
        INSERT INTO telegram_users (telegram_id, username, wallet_address, encrypted_private_key, created_at)
        VALUES (
            '987654321', 
            'demo_user', 
            '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', 
            'mock_key', 
            NOW()
        )
        ON CONFLICT (telegram_id) DO NOTHING;
    `);
        console.log('Added Mock Telegram User');

    } catch (e) {
        console.error('Seed error:', e);
    } finally {
        pool.end();
    }
}

seedUsers();
