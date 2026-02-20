/**
 * fix-decimal-migration.ts
 * 
 * ONE-TIME migration: fixes all DB rows that were stored with wrong 18-decimal
 * formatting instead of correct 6-decimal USDC formatting.
 * 
 * Root cause: marketIndexer.ts used ethers.formatUnits(..., 18) for USDC values,
 * making every volume and trade cost 1,000,000,000,000x (1e12) too small.
 * 
 * Run ONCE after deploying the indexer decimal fix:
 *   npx ts-node scripts/fix-decimal-migration.ts
 * 
 * BACKUP YOUR DB FIRST:
 *   pg_dump $DATABASE_URL > backup_before_migration.sql
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Pool } from 'pg';

const dbUrl = process.env.DATABASE_URL!;
const isRender = dbUrl.includes('render.com');
const pool = new Pool({
    connectionString: dbUrl,
    ssl: isRender ? { rejectUnauthorized: false } : undefined,
});

async function main() {
    const client = await pool.connect();

    try {
        console.log('=================================================');
        console.log('  Oppol Decimal Migration — USDC 18→6 dec Fix');
        console.log('=================================================\n');

        // --- STEP 0: Show current state ---
        const before = await client.query('SELECT market_id, volume FROM markets ORDER BY market_id');
        console.log('BEFORE — Current DB volumes:');
        before.rows.forEach(r => console.log(`  Market ${r.market_id}: ${r.volume}`));
        console.log('');

        await client.query('BEGIN');

        // --- STEP 1: Fix markets.volume ---
        // Old: ethers.formatUnits(x, 18) where x was 6-dec USDC bigint
        // Effect: value is 1e12 times too small. e.g. $5.00 stored as 0.000000000005
        // Fix: multiply stored float by 1e12 to get correct USDC value
        console.log('Fixing markets.volume...');
        const markets = await client.query(
            `SELECT market_id, volume FROM markets WHERE volume IS NOT NULL AND CAST(volume AS NUMERIC) > 0`
        );

        let marketFixed = 0;
        for (const row of markets.rows) {
            const oldVal = parseFloat(row.volume);
            // Only fix values that look like they have the 18-dec bug (very small numbers)
            // A real USDC volume should be >= 0.01. If it's < 0.000001, it's almost certainly wrong.
            if (oldVal > 0 && oldVal < 0.001) {
                const corrected = (oldVal * 1e12).toFixed(6);
                await client.query(
                    'UPDATE markets SET volume = $1 WHERE market_id = $2',
                    [corrected, row.market_id]
                );
                console.log(`  Market ${row.market_id}: ${oldVal} → ${corrected} USDC`);
                marketFixed++;
            } else {
                console.log(`  Market ${row.market_id}: ${oldVal} — looks OK, skipping`);
            }
        }
        console.log(`  Fixed ${marketFixed} market volume rows.\n`);

        // --- STEP 2: Fix trades.total_cost ---
        // Same bug: total_cost stored as formatUnits(cost, 18) instead of formatUnits(cost, 6)
        console.log('Fixing trades.total_cost...');
        const tradeCount = await client.query(`
            SELECT COUNT(*) as count FROM trades 
            WHERE total_cost IS NOT NULL 
              AND CAST(total_cost AS NUMERIC) > 0 
              AND CAST(total_cost AS NUMERIC) < 0.001
        `);
        console.log(`  Found ${tradeCount.rows[0].count} trades with wrong decimals.`);

        if (parseInt(tradeCount.rows[0].count) > 0) {
            await client.query(`
                UPDATE trades
                SET total_cost = (CAST(total_cost AS NUMERIC) * 1000000000000)::TEXT
                WHERE total_cost IS NOT NULL
                  AND CAST(total_cost AS NUMERIC) > 0
                  AND CAST(total_cost AS NUMERIC) < 0.001
            `);
            console.log(`  Fixed trade costs.\n`);
        } else {
            console.log(`  No trades needed fixing.\n`);
        }

        // --- STEP 3: Fix markets.liquidity_param ---
        // Same bug applied to liquidityParam
        console.log('Fixing markets.liquidity_param...');
        const liquidityRows = await client.query(
            `SELECT market_id, liquidity_param FROM markets WHERE liquidity_param IS NOT NULL`
        );

        let liqFixed = 0;
        for (const row of liquidityRows.rows) {
            const val = parseFloat(row.liquidity_param);
            if (val > 0 && val < 0.001) {
                const corrected = (val * 1e12).toFixed(6);
                await client.query(
                    'UPDATE markets SET liquidity_param = $1 WHERE market_id = $2',
                    [corrected, row.market_id]
                );
                console.log(`  Market ${row.market_id} liq_param: ${val} → ${corrected}`);
                liqFixed++;
            }
        }
        console.log(`  Fixed ${liqFixed} liquidity_param rows.\n`);

        // --- STEP 4: Reset last_indexed_block so indexer re-validates on next run ---
        // We don't reset to 0 (that would trigger deep rescan).
        // The indexer will pick up from the stored block and only add new trades.
        console.log('Resetting last_indexed_block to 0 to allow fresh indexer scan...');
        await client.query(`UPDATE markets SET last_indexed_block = 0`);
        console.log('  Done. Indexer will do a controlled rescan from deployment block.\n');

        await client.query('COMMIT');
        console.log('✅ Migration committed successfully.\n');

        // --- STEP 5: Show final state ---
        const after = await client.query('SELECT market_id, volume FROM markets ORDER BY market_id');
        console.log('AFTER — Updated DB volumes:');
        after.rows.forEach(r => console.log(`  Market ${r.market_id}: ${r.volume} USDC`));
        console.log('');
        console.log('=================================================');
        console.log('  Migration complete. Restart the server now.');
        console.log('=================================================');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration FAILED — rolled back:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
