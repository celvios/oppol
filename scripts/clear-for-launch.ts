/**
 * clear-for-launch.ts
 * 
 * ⚠️  DESTRUCTIVE: Wipes all market, trade, user, and wallet data for a clean launch.
 * 
 * Run AFTER drain-contract-funds.ts:
 *   npx ts-node scripts/clear-for-launch.ts
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL!;
const isRender = dbUrl.includes('render.com');
const pool = new Pool({
    connectionString: dbUrl,
    ssl: isRender ? { rejectUnauthorized: false } : undefined,
});

async function main() {
    const client = await pool.connect();

    console.log('==========================================================');
    console.log('  ⚠️  CLEAR FOR LAUNCH — DESTRUCTIVE OPERATION');
    console.log('==========================================================\n');

    // Show what we're about to delete
    const counts = await client.query(`
        SELECT
            (SELECT COUNT(*) FROM markets) as markets,
            (SELECT COUNT(*) FROM trades) as trades,
            (SELECT COUNT(*) FROM price_history) as price_history,
            (SELECT COUNT(*) FROM users) as users,
            (SELECT COUNT(*) FROM wallets) as wallets
    `);
    console.log('Current row counts:');
    console.log(JSON.stringify(counts.rows[0], null, 2));
    console.log('');

    try {
        await client.query('BEGIN');

        // Clear in dependency order
        console.log('Clearing price_history...');
        await client.query('DELETE FROM price_history');

        console.log('Clearing trades...');
        await client.query('DELETE FROM trades');

        console.log('Clearing markets...');
        await client.query('DELETE FROM markets');

        console.log('Clearing wallets...');
        await client.query('DELETE FROM wallets');

        console.log('Clearing users...');
        await client.query('DELETE FROM users');

        // Reset any sequences
        console.log('Resetting sequences...');
        await client.query(`
            DO $$
            DECLARE
                seq_name text;
            BEGIN
                FOR seq_name IN SELECT sequence_name FROM information_schema.sequences
                                WHERE sequence_schema = 'public'
                LOOP
                    EXECUTE 'ALTER SEQUENCE ' || seq_name || ' RESTART WITH 1';
                END LOOP;
            END $$
        `).catch(() => { }); // Non-fatal if sequences don't exist

        await client.query('COMMIT');

        // Verify
        const verify = await client.query(`
            SELECT
                (SELECT COUNT(*) FROM markets) as markets,
                (SELECT COUNT(*) FROM trades) as trades,
                (SELECT COUNT(*) FROM price_history) as price_history,
                (SELECT COUNT(*) FROM users) as users,
                (SELECT COUNT(*) FROM wallets) as wallets
        `);
        console.log('\n✅ After clear:');
        console.log(JSON.stringify(verify.rows[0], null, 2));
        console.log('\nDB is clean. Ready for launch!');

    } catch (e: any) {
        await client.query('ROLLBACK');
        console.error('❌ Clear failed — rolled back:', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(e => {
    console.error('Fatal:', e.message);
    process.exit(1);
});
