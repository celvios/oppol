
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function inspectMarket() {
    try {
        const marketId = 5; // The market in question
        console.log(`Connecting to database to inspect Market ${marketId}...`);
        const client = await pool.connect();

        const res = await client.query(`
      SELECT * FROM markets WHERE market_id = $1
    `, [marketId]);

        if (res.rows.length === 0) {
            console.log('Market not found in DB!');
        } else {
            const m = res.rows[0];
            console.log('\n--- RAW DB DATA ---');
            console.log('market_id:', m.market_id);
            console.log('question:', m.question);
            console.log('volume (raw string):', `'${m.volume}'`);
            console.log('prices (raw json):', m.prices);
            console.log('outcome_names (raw json):', m.outcome_names);
            console.log('liquidity_param:', m.liquidity_param);
            console.log('last_indexed_at:', m.last_indexed_at);
            console.log('-------------------\n');

            // Emulate API logic to ensure it doesn't crash
            try {
                let prices = m.prices;
                if (typeof prices === 'string') {
                    prices = JSON.parse(prices);
                }
                console.log('Parsed Prices:', prices);
                console.log('Volume Check:', m.volume || '0');
            } catch (e) {
                console.error('API Parsing Logic Failed:', e);
            }
        }

        client.release();
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

inspectMarket();
