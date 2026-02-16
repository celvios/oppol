import { query } from './src/config/database';

async function run() {
    try {
        const schemaRes = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'bets'
        `);
        console.log("Bets Columns:", schemaRes.rows.map((r: any) => `${r.column_name} (${r.data_type})`));

        const sumRes = await query("SELECT SUM(CAST(amount AS NUMERIC)) as total_bets FROM bets");
        console.log("Total Bets from bets table:", sumRes.rows[0].total_bets);

        const marketsSumRes = await query("SELECT SUM(CAST(NULLIF(CAST(volume AS TEXT), '') AS NUMERIC)) as total_volume FROM markets");
        console.log("Total Volume from markets table:", marketsSumRes.rows[0].total_volume);

    } catch (e: any) {
        console.error("Error:", e.message);
    } finally {
        process.exit(0);
    }
}
run();
