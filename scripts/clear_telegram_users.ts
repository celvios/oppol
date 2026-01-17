import pool from '../src/config/database';

async function clearTelegramUsers() {
    try {
        await pool.query('DELETE FROM telegram_transactions');
        await pool.query('DELETE FROM telegram_users');
        console.log('✅ Cleared telegram_users and telegram_transactions tables');
        await pool.end();
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

clearTelegramUsers();