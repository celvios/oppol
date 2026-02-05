import { query } from '../src/config/database';

async function addBoostColumns() {
    try {
        console.log('Adding boost columns to markets table...');
        
        await query(`
            ALTER TABLE markets ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT FALSE;
            ALTER TABLE markets ADD COLUMN IF NOT EXISTS boost_expires_at BIGINT DEFAULT 0;
            ALTER TABLE markets ADD COLUMN IF NOT EXISTS boost_tier INT DEFAULT 0;
        `);
        
        console.log('✅ Boost columns added successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error adding boost columns:', error);
        process.exit(1);
    }
}

addBoostColumns();
