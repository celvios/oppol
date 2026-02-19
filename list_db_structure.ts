
import { Pool } from "pg";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env") });

async function listTables() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const res = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);

        console.log("Tables found:", res.rows.map(r => r.table_name));

        // Also check columns for 'users' or 'User' if it exists
        const userTable = res.rows.find(r => r.table_name.toLowerCase() === 'users' || r.table_name.toLowerCase() === 'user');
        if (userTable) {
            const cols = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = $1
             `, [userTable.table_name]);
            console.log(`\nColumns in ${userTable.table_name}:`, cols.rows.map(c => c.column_name));
        }

    } catch (error: any) {
        console.error("Error:", error.message);
    } finally {
        await pool.end();
    }
}

listTables().catch(console.error);
