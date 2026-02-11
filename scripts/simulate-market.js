
const { Pool } = require('pg');
const { ethers } = require('ethers');
require('dotenv').config();

async function main() {
    const MARKET_ID = 999999;

    // Connect to DB
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Required for verified generic postgres
    });

    console.log(`[Simulation] 🧪 Starting simulation for Market #${MARKET_ID}...`);

    try {
        // 1. Clean up potential old test data
        await pool.query('DELETE FROM markets WHERE market_id = $1', [MARKET_ID]);

        // 2. Create Test Market
        const now = Math.floor(Date.now() / 1000);
        const endTime = now + 3600; // Ends in 1 hour
        const outcomes = ['Yes', 'No'];
        const prices = [50, 50];

        await pool.query(
            `INSERT INTO markets (market_id, question, description, image, outcome_names, prices, resolved, winning_outcome, end_time, liquidity_param, outcome_count, volume, last_indexed_at, category)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), 'Test')`,
            [
                MARKET_ID,
                "⚠️ TEST MARKET: Will volume update in real-time?",
                "This is a simulation to verify the data sync fix without spending real money.",
                "https://placehold.co/400x400/27E8A7/000000?text=TEST",
                JSON.stringify(outcomes),
                JSON.stringify(prices),
                false,
                0,
                new Date(endTime * 1000),
                "1000",
                2,
                "0"
            ]
        );

        console.log(`[Simulation] ✅ Created Test Market #${MARKET_ID}`);
        console.log(`[Simulation] 👀 Check the UI now! You should see the market with $0 volume.`);
        console.log(`[Simulation] ⏳ Waiting 15 seconds before simulating a trade...`);

        await new Promise(resolve => setTimeout(resolve, 15000));

        // 3. Simulate Trade (Update Volume)
        const newVolume = "500.0"; // $500 volume

        await pool.query(
            `UPDATE markets SET volume = $1, last_indexed_at = NOW() WHERE market_id = $2`,
            [newVolume, MARKET_ID]
        );

        console.log(`[Simulation] 🚀 BOOST! Database updated: Market #${MARKET_ID} volume set to $500.`);
        console.log(`[Simulation] 👀 The UI should reflect this change momentarily (within 30s poll or immediate if refetched).`);

        // 4. Simulate another update
        await new Promise(resolve => setTimeout(resolve, 10000));
        const newVolume2 = "1250.0"; // $1250 volume

        await pool.query(
            `UPDATE markets SET volume = $1, last_indexed_at = NOW() WHERE market_id = $2`,
            [newVolume2, MARKET_ID]
        );
        console.log(`[Simulation] 🚀 BOOST 2! Database updated: Market #${MARKET_ID} volume set to $1,250.`);


    } catch (error) {
        console.error('[Simulation] ❌ Error:', error);
    } finally {
        await pool.end();
    }
}

main();
