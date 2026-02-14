
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function verifyCategoryFix() {
    const testCategory = "Verified_Category_" + Date.now();
    console.log(`Testing category: ${testCategory}`);

    try {
        // 1. Logic mirrored from marketController.ts
        // Ensure category exists
        await pool.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [testCategory]);
        console.log("Executed INSERT ON CONFLICT for category");

        // 2. Verify it exists
        const res = await pool.query('SELECT * FROM categories WHERE name = $1', [testCategory]);
        if (res.rows.length > 0) {
            console.log("SUCCESS: Category found in DB!");
        } else {
            console.error("FAILURE: Category NOT found in DB.");
        }

        // Clean up
        await pool.query('DELETE FROM categories WHERE name = $1', [testCategory]);
        console.log("Cleaned up test category");

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

verifyCategoryFix();
