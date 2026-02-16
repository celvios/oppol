require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function main() {
    try {
        console.log('📊 Calculating Total Fees...');

        // Fetch oldest market date
        const res = await pool.query('SELECT created_at FROM markets ORDER BY created_at ASC LIMIT 1');
        if (res.rows.length > 0) {
            console.log('Oldest Market Date:', res.rows[0].created_at);
        }

        let totalVolume = 0;
        let marketCount = 0;

        console.log('\n--- Market Volumes ---');

        for (const row of res.rows) {
            const vol = parseFloat(row.volume);
            if (!isNaN(vol) && vol > 0) {
                totalVolume += vol;
                marketCount++;
                console.log(`ID ${row.market_id}: $${vol.toFixed(2)} - ${row.question.substring(0, 30)}...`);
            }
        }

        // Fee Calculation: 10% of Volume
        // Based on analysis: 
        // 1. Fee is added "ON TOP" of cost (app.ts) -> User pays Cost + Fee
        // 2. SharesPurchased event emits 'cost' (Collateral used for shares)
        // 3. Volume is sum of 'cost'
        // 4. Fee = Cost * 10% (1000 bps)

        const totalFees = totalVolume * 0.10;

        console.log('\n==========================================');
        console.log(`Total Markets with Volume: ${marketCount}`);
        console.log(`Total Volume (USDC):       $${totalVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        console.log(`Total Fees (10%):          $${totalFees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        console.log('==========================================\n');

        // Also check if we can query 'trades' table directly for more accuracy if available
        // But volume in markets table comes from blockchain indexer so it should be the source of truth

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

main();
