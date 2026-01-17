
import pool from '../src/config/database';

async function main() {
    try {
        console.log('Cleaning market descriptions...');
        const res = await pool.query("UPDATE markets SET description = '' WHERE description = 'Synced from Chain'");
        console.log(`Updated ${res.rowCount} markets.`);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
}

main();
