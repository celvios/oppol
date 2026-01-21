import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('render.com'))
        ? { rejectUnauthorized: false }
        : undefined,
});

async function clearComments() {
    try {
        console.log('🗑️  Clearing comments and likes...');

        // Delete from dependent table first (if cascade isn't set, improving safety)
        await pool.query('DELETE FROM comment_likes');
        const res = await pool.query('DELETE FROM comments');

        console.log(`✅ Successfully deleted ${res.rowCount} comments.`);
        console.log('✨ Database is clean.');
    } catch (error) {
        console.error('❌ Error clearing comments:', error);
    } finally {
        await pool.end();
    }
}

clearComments();
