
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkSchema() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'markets'
        `);
        console.log("Markets Table Columns:", res.rows.map(r => `${r.column_name} (${r.data_type})`));

        // Also check if existing markets have created_at populated
        const dataRes = await pool.query('SELECT market_id, created_at FROM markets LIMIT 5');
        console.log("Sample Data:", dataRes.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

checkSchema();
