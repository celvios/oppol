
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkCategory() {
    const testCategory = "Test_New_Category_" + Date.now();
    console.log(`Testing category: ${testCategory}`);

    try {
        // 1. Check if category exists (should be false)
        const res1 = await pool.query('SELECT * FROM categories WHERE name = $1', [testCategory]);
        console.log(`Category exists before: ${res1.rows.length > 0}`);

        // 2. Simulate market creation with this new category (using the logic from marketController)
        // Note: effectively doing what createMarketMetadata does but bypassing the API for quick check
        // Wait... I can't easily simulate the API call without running the server.
        // Instead, let's verify if the markets table insert ALONE triggers a category insert (via trigger?)
        // But better yet, I'll just check if there IS any code in the codebase that handles "get or create category".

        // Since I already looked at marketController.ts and SAW it doesn't do it, I am 99% sure.
        // marketController.ts:
        // await query('insert into markets ... values (..., category, ...)', [..., categoryId, ...])

        // If there is no DB trigger, this explains it.

        const triggerRes = await pool.query(`
            SELECT trigger_name 
            FROM information_schema.triggers 
            WHERE event_object_table = 'markets'
        `);
        console.log("Triggers on markets table:", triggerRes.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

checkCategory();
