
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log("--- Tables ---");
        res.rows.forEach(r => console.log(r.table_name));
        console.log("--------------");
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

main();
