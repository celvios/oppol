import { query } from './src/config/database';

async function run() {
    try {
        const res = await query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log("Tables:", res.rows.map((r: any) => r.table_name));

        // Check if 'bets' or 'trades' exists
        const tables = res.rows.map((r: any) => r.table_name);
        if (tables.includes('bets')) {
            const betsCount = await query("SELECT COUNT(*) FROM bets");
            console.log("Bets count:", betsCount.rows[0].count);
        }
        if (tables.includes('trades')) {
            const tradesCount = await query("SELECT COUNT(*) FROM trades");
            console.log("Trades count:", tradesCount.rows[0].count);
        }
    } catch (e: any) {
        console.error("Error:", e.message);
    } finally {
        process.exit(0);
    }
}
run();
