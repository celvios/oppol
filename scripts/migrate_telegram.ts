
import pool from '../src/config/database';

async function runMigration() {
    try {
        console.log('🔄 Running telegram tables migration...');

        // 1. Telegram Users
        await pool.query(`
            CREATE TABLE IF NOT EXISTS telegram_users (
                id SERIAL PRIMARY KEY,
                telegram_id BIGINT UNIQUE NOT NULL,
                username VARCHAR(255),
                wallet_address VARCHAR(42),
                encrypted_private_key TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✅ telegram_users table checked/created');

        // 2. WhatsApp Users
        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_users (
                id SERIAL PRIMARY KEY,
                phone_number VARCHAR(20) UNIQUE NOT NULL,
                wallet_address VARCHAR(42),
                encrypted_private_key TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✅ whatsapp_users table checked/created');

        // 3. Transactions 
        await pool.query(`
            CREATE TABLE IF NOT EXISTS telegram_transactions (
                id SERIAL PRIMARY KEY,
                telegram_id BIGINT,
                type VARCHAR(20), -- BET, DEPOSIT, WITHDRAW
                market_id INTEGER,
                outcome INTEGER,
                amount DECIMAL,
                tx_hash VARCHAR(66),
                status VARCHAR(20), -- PENDING, CONFIRMED, FAILED
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✅ telegram_transactions table checked/created');

        console.log('🎉 Migration completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        // Pool is managed by the imported module, but we can try to end it if we are exiting script
        // However, standard process.exit(0) is fine for scripts
    }
}

runMigration();