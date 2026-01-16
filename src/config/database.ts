import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();


// Try to use Real DB
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    throw new Error('❌ DATABASE_URL is missing. Please configure it in your environment variables.');
}

const pool = new Pool({
    connectionString: dbUrl,
    ssl: (process.env.NODE_ENV === 'production' || dbUrl.includes('render.com'))
        ? { rejectUnauthorized: false }
        : undefined,
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
export default pool;
