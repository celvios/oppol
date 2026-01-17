import { query } from '../src/config/database';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    try {
        console.log('Checking comments table...');
        const res = await query('SELECT count(*) FROM comments');
        console.log('✅ Comments table exists. Count:', res.rows[0].count);

        // Check columns
        const colRes = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        console.log('Users Columns:', colRes.rows.map((r: any) => `${r.column_name} (${r.data_type})`).join(', '));

    } catch (e: any) {
        console.error('❌ Check failed:', e.message);
    }
}

main();
