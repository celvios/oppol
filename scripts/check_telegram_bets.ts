
import { query } from '../src/config/database';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    try {
        const res = await query(
            "SELECT * FROM telegram_transactions ORDER BY created_at DESC LIMIT 5"
        );
        console.log("Recent Telegram Transactions:");
        res.rows.forEach(r => {
            console.log(`- ID: ${r.id}, User: ${r.telegram_id}, Market: ${r.market_id}, Status: ${r.status}, Amount: ${r.amount}, Tx: ${r.tx_hash}`);
        });
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

main();
