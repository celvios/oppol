
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkUsers() {
    try {
        console.log('Checking database:', process.env.DATABASE_URL);

        // Check tables existence first
        const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
        console.log('Tables found:', tables.rows.map(r => r.table_name).join(', '));

        // Check users
        try {
            const wa = await pool.query('SELECT count(*) FROM whatsapp_users');
            console.log(`WhatsApp Users: ${wa.rows[0].count}`);
        } catch (e) { console.log('Error checking whatsapp_users:', e.message); }

        try {
            const tg = await pool.query('SELECT count(*) FROM telegram_users');
            console.log(`Telegram Users: ${tg.rows[0].count}`);
        } catch (e) { console.log('Error checking telegram_users:', e.message); }

    } catch (e) {
        console.error('Database connection error:', e);
    } finally {
        pool.end();
    }
}

checkUsers();
