require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query('SELECT id, public_address FROM wallets ORDER BY id LIMIT 30')
    .then(r => {
        r.rows.forEach(row => console.log(row.id, row.public_address));
        pool.end();
    })
    .catch(e => { console.error(e.message); pool.end(); });
