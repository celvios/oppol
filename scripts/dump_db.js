const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('--- Dumping Markets Table ---');
        const res = await pool.query('SELECT * FROM markets');
        console.log(`Row Count: ${res.rows.length}`);
        if (res.rows.length > 0) {
            console.log('Sample Row Keys:', Object.keys(res.rows[0]));
            console.log('First 5 Rows:');
            res.rows.slice(0, 5).forEach(row => {
                console.log(JSON.stringify(row));
            });
        } else {
            console.log('Table is empty.');
        }
        await pool.end();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

run();
