import dotenv from 'dotenv';
dotenv.config();
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function wipeDatabase() {
    console.log('⚠️  Starting complete database wipe...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Truncate all main tables and cascade to drop all related rows
        const query = `
            TRUNCATE TABLE 
                users, 
                wallets, 
                markets, 
                outcomes, 
                trades, 
                price_history, 
                deposits, 
                market_resolutions,
                news_feed,
                boost_purchases,
                comments
            CASCADE;
        `;

        console.log('Dropping all rows from primary tables (CASCADE)...');
        await client.query(query);

        await client.query('COMMIT');
        console.log('✅ Database completely wiped clean. Ready for redeployment.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error wiping database:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

wipeDatabase();
