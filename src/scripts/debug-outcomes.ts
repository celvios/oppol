
import pool from '../config/database';

async function calculateOutcomesLength() {
    console.log('🔍 Analyzing market data for "320 outcomes" bug...');

    try {
        // Fetch the 4 trend markets
        // IDs: 1001, 1002, 1003, 1004
        const queryText = `SELECT market_id, question, outcome_names FROM markets WHERE market_id IN (1001, 1002, 1003, 1004)`;
        const result = await pool.query(queryText);

        console.log(`\nFound ${result.rows.length} trend markets.\n`);

        for (const row of result.rows) {
            console.log(`--------------------------------------------------`);
            console.log(`Market ID: ${row.market_id}`);
            console.log(`Question: ${row.question}`);
            console.log(`Raw outcome_names type: ${typeof row.outcome_names}`);
            console.log(`Raw outcome_names value:`, row.outcome_names);

            if (typeof row.outcome_names === 'string') {
                console.log(`⚠️  outcome_names IS A STRING!`);
                console.log(`String length: ${row.outcome_names.length}`);
            } else if (Array.isArray(row.outcome_names)) {
                console.log(`✅ outcome_names is an Array.`);
                console.log(`Array length: ${row.outcome_names.length}`);
            } else {
                console.log(`❓ outcome_names is ${typeof row.outcome_names}`);
            }
        }

        console.log(`\n--------------------------------------------------`);
        process.exit(0);

    } catch (error) {
        console.error('❌ Error in debug script:', error);
        process.exit(1);
    }
}

calculateOutcomesLength();
