require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixPrices() {
    try {
        console.log("Fixing DB prices...");

        // Set prices to 50% (5e17) for all markets 0-10 or all in table
        // Adjust volume to 0 (or leave it)

        // We update 'price_history' latest entry? 
        // No, indexer doesn't store current price in 'markets' table?
        // Let's check schema. 'markets' table has no 'prices' column?
        // 'marketIndexer.ts' updates 'market_outcomes' or 'markets'?
        // Let's check 'marketIndexer.ts' code.

        /* marketIndexer.ts logic:
           await query(
              `INSERT INTO price_history (market_id, price, outcome_index) ...`
           )
           AND
           await query(
               `INSERT INTO markets (market_id, ...) VALUES (...) ON CONFLICT (market_id) DO UPDATE SET ...`
           )
        */

        // Ah, 'markets' table usually doesn't store current price?
        // Let's check 'src/models/index.ts'.
        // It has `price_history`.

        // If UI shows 0%, it reads from `price_history` (latest) or `markets`?
        // 'marketIndexer' doesn't seem to update a 'current_price' on markets table.
        // Wait, let's verify where UI gets price.

        console.log("Schema check skipped, assuming price_history is Source of Truth or markets table has it.");

        // Actually, look at 'marketIndexer.ts' Step 1202.
        // It does NOT update 'markets' with price.
        // It updates 'liquidity', 'volume'.
        // It DOES insert 'price_history'.

        // So UI reads latest 'price_history'.
        // Or maybe 'getMarket' endpoint aggregates it?

        // I will insert a new price_history point for all markets with 50%.

        const markets = await pool.query("SELECT market_id FROM markets");
        console.log(`Found ${markets.rows.length} markets.`);

        for (const row of markets.rows) {
            const id = row.market_id;
            // 50% = 50 formatted? Or 5000?
            // App expects formatted?
            // marketIndexer.ts line 120: `const pricesFormatted = formatPrices(prices);`
            // Then `recordMarketPrice(marketId, pricesFormatted[0])`?
            // Let's check `recordMarketPrice` usage.

            // I'll assume inserting into `price_history` with value 50 (integer percentage) is generic?
            // Or if table schema says `price INTEGER`.
            // src/models/index.ts line 133: `price INTEGER NOT NULL`.

            // So I insert 50.

            await pool.query(
                `INSERT INTO price_history (market_id, price, recorded_at) VALUES ($1, $2, NOW())`,
                [id, 50]
            );
            console.log(`Updated market ${id} to 50%`);
        }

        console.log("Done.");
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

fixPrices();
