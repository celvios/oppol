
import pool from '../src/config/database';

async function main() {
    try {
        console.log('Checking DB Content...');
        const res = await pool.query('SELECT market_id, question FROM markets ORDER BY market_id ASC');
        console.log(`Found ${res.rowCount} markets:`);
        res.rows.forEach(r => console.log(`[${r.market_id}] ${r.question}`));
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
}

main();
