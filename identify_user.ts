
import { Pool } from "pg";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env") });

const RECIPIENT_ADDRESS = "0x3B6a79d61523631473CF80d3845E9e6A0B11e5a4";

async function identifyUser() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    console.log(`Checking database for user with wallet: ${RECIPIENT_ADDRESS}`);

    try {
        const res = await pool.query(`
            SELECT * FROM users 
            WHERE wallet_address ILIKE $1 
        `, [RECIPIENT_ADDRESS]);

        if (res.rows.length > 0) {
            const user = res.rows[0];
            console.log("✅ User FOUND in database!");
            console.log("--------------------------------------------------");
            console.log(`User ID: ${user.id}`);
            console.log(`Display Name: ${user.display_name || 'N/A'}`);
            console.log(`Phone: ${user.phone_number || 'N/A'}`);
            console.log(`Privy User ID: ${user.privy_user_id || 'N/A'}`);
            console.log(`Created At: ${user.created_at}`);
            console.log("--------------------------------------------------");
        } else {
            console.log("❌ User NOT found in database with this wallet address.");
        }

    } catch (error: any) {
        console.error("Error querying database:", error.message);
    } finally {
        await pool.end();
    }
}

identifyUser().catch(console.error);
