/**
 * Migration: create failed_sweeps table
 * This table is the fallback recovery log when sweepGasFeeFor() fails
 * all retry attempts in betController.ts.
 *
 * Run: npx ts-node src/scripts/create-failed-sweeps-table.ts
 */

import { query } from '../config/database';

async function main() {
    console.log('[Migration] Creating failed_sweeps table...');

    await query(`
        CREATE TABLE IF NOT EXISTS failed_sweeps (
            id              SERIAL PRIMARY KEY,
            user_address    VARCHAR(42)    NOT NULL,
            amount          NUMERIC(30,18) NOT NULL,          -- USDC amount that was not swept
            trade_tx_hash   VARCHAR(66)    NOT NULL UNIQUE,   -- the successful trade tx that triggered the sweep
            reconciled      BOOLEAN        NOT NULL DEFAULT FALSE,
            created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
            reconciled_at   TIMESTAMPTZ
        );
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS idx_failed_sweeps_unreconciled
            ON failed_sweeps (reconciled, created_at)
            WHERE reconciled = FALSE;
    `);

    console.log('[Migration] ✅ failed_sweeps table ready.');
    process.exit(0);
}

main().catch(err => {
    console.error('[Migration] ❌ Failed:', err);
    process.exit(1);
});
