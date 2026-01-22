import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();


// Try to use Real DB
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    throw new Error('❌ DATABASE_URL is missing. Please configure it in your environment variables.');
}

const isRender = dbUrl.includes('render.com');
const sslConfig = (process.env.NODE_ENV === 'production' || isRender) ? { rejectUnauthorized: false } : undefined;

const pool = new Pool({
    connectionString: dbUrl,
    ssl: sslConfig,
    max: 20, // Increased from default 10
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

pool.on('error', (err, client) => {
    console.error('❌ Unexpected error on idle client', err);
    process.exit(-1);
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
export default pool;
