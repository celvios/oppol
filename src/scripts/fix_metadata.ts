
import pool from '../config/database';

async function fixMetadata() {
    try {
        console.log('--- Fixing Metadata for Market 7 ---');

        // 1. Check what is there
        const res = await pool.query('SELECT * FROM markets WHERE market_id = 7');
        if (res.rows.length > 0) {
            console.log('Found Stale Market in DB:', res.rows[0].question);
        } else {
            console.log('Market 7 not found in DB (already fixed?)');
        }

        // 2. Delete it
        await pool.query('DELETE FROM markets WHERE market_id = 7');
        console.log('✅ Deleted Market 7 metadata from DB.');

        // 3. Verify
        const check = await pool.query('SELECT * FROM markets WHERE market_id = 7');
        if (check.rows.length === 0) {
            console.log('Verification Passed: Market 7 is gone.');
        }

    } catch (e: any) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
    }
}

fixMetadata();
