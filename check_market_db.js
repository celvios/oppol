
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        console.log("Listing tables (debug)...");
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log(`Found ${res.rowCount} tables.`);
        console.log(res.rows.map(r => r.table_name).join(", "));

        // Try common names
        const tables = ['trades', 'bets', 'orders', 'positions', 'transactions'];
        for (const t of tables) {
            try {
                console.log(`Checking table '${t}'...`);
                const r = await pool.query(`SELECT COUNT(*) FROM "${t}"`);
                console.log(`Table '${t}' exists. Rows: ${r.rows[0].count}`);

                if (t === 'trades' || t === 'bets') {
                    // Check columns
                    const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${t}'`);
                    console.log(`Columns in ${t}:`, cols.rows.map(c => c.column_name).join(', '));
                }
            } catch (e) {
                // console.log(`Table '${t}' does not exist.`);
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

main();
