
import pool from '../config/database';

async function dumpMarkets() {
    console.log('📊 Dumping markets table...');
    try {
        const result = await pool.query('SELECT market_id, question, outcome_names FROM markets');

        console.log(`Found ${result.rows.length} markets.`);

        for (const row of result.rows) {
            console.log('\n--- Market ---');
            console.log(`ID: ${row.market_id}`);
            console.log(`Question: ${row.question}`);
            console.log(`Type of outcome_names: ${typeof row.outcome_names}`);
            if (typeof row.outcome_names === 'string') {
                console.log(`Value: "${row.outcome_names}"`);
                console.log(`Length: ${row.outcome_names.length}`);
            } else {
                console.log(`Value:`, JSON.stringify(row.outcome_names));
                console.log(`Is Array? ${Array.isArray(row.outcome_names)}`);
                if (Array.isArray(row.outcome_names)) {
                    console.log(`Array Length: ${row.outcome_names.length}`);
                }
            }
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

dumpMarkets();
