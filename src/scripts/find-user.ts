import dotenv from 'dotenv';
dotenv.config();
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    const client = await pool.connect();
    const result = await client.query(
        `SELECT u.id, u.privy_user_id, w.public_address as eoa
         FROM users u 
         JOIN wallets w ON w.user_id = u.id
         WHERE LOWER(u.wallet_address) = LOWER($1)
            OR LOWER(w.public_address) = LOWER($1)`,
        ['0x21F9d17DF23a847f459d3124dC0E790bdeCf6Fd5']
    );
    console.log(JSON.stringify(result.rows, null, 2));
    await client.release();
    await pool.end();
}
main().catch(console.error);
