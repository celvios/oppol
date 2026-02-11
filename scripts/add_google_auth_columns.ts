import { query } from '../src/config/database';

async function migrate() {
    try {
        console.log('Adding email and google_id columns to users table...');

        await query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS email VARCHAR(255),
            ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
        `, []);

        console.log('✅ Migration successful');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
