
import pool from '../config/database';

async function nukeMarkets() {
    try {
        console.log('--- NUKING MARKETS TABLE ---');
        console.log('Reason: Complete Desync between DB and Blockchain.');

        await pool.query('TRUNCATE TABLE markets CASCADE');

        console.log('✅ TRUNCATE COMPLETE.');
        console.log('The app will now pull raw questions from the Blockchain.');

    } catch (e: any) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
    }
}

nukeMarkets();
