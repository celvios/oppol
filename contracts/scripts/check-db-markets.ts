import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load env from root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
    console.log("🔍 Checking Database for Markets...");
    console.log("DB URL:", process.env.DATABASE_URL?.replace(/:[^:]*@/, ':****@')); // Hide password

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query('SELECT market_id, question, created_at FROM markets ORDER BY market_id DESC LIMIT 5');

        console.log(`\nFound ${res.rowCount} markets:`);
        res.rows.forEach(row => {
            console.log(`[ID ${row.market_id}] "${row.question}" (Created: ${row.created_at})`);
        });

    } catch (e: any) {
        console.error("Error:", e.message);
    } finally {
        await client.end();
    }
}

main();
