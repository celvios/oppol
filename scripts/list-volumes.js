
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function listVolumes() {
    try {
        const client = await pool.connect();
        console.log('Connected to database. Fetching volumes...');

        // Select market_id as id for display
        const res = await client.query(`
      SELECT market_id as id, question, volume 
      FROM markets 
      ORDER BY volume::numeric DESC
    `);

        console.log('\n--- MARKET VOLUMES (Source of Truth) ---');
        console.log('ID    | Volume     | Question');
        console.log('--------------------------------------------------');
        res.rows.forEach(row => {
            // Clean up inputs for display
            const vol = row.volume ? parseFloat(row.volume).toFixed(2) : "0.00";
            const q = row.question ? row.question.substring(0, 50).padEnd(50) : "No Question".padEnd(50);
            console.log(`${row.id.toString().padEnd(5)} | $${vol.toString().padEnd(9)} | ${q}...`);
        });
        console.log('--------------------------------------------------\n');

        client.release();
    } catch (err) {
        console.error('Error fetching volumes:', err);
    } finally {
        await pool.end();
    }
}

listVolumes();
