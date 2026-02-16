import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    try {
        await client.connect();
        const res = await client.query(`
            SELECT DISTINCT wallet_address 
            FROM (
                SELECT wallet_address FROM users 
                UNION 
                SELECT wallet_address FROM whatsapp_users 
                UNION 
                SELECT wallet_address FROM telegram_users
            ) as all_addresses 
            WHERE wallet_address IS NOT NULL
        `);
        console.log(JSON.stringify(res.rows.map(r => r.wallet_address)));
    } catch (e: any) {
        console.error(e.message);
    } finally {
        await client.end();
    }
}
run();
