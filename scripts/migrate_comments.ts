import { query } from '../src/config/database';
import dotenv from 'dotenv';
dotenv.config();

const sql = `
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    market_id INTEGER NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_comments_market_id ON comments(market_id);
`;

async function main() {
    try {
        console.log('Running migration...');
        await query(sql);
        console.log('✅ Comments table created successfully');
        process.exit(0);
    } catch (e) {
        console.error('❌ Migration failed:', e);
        process.exit(1);
    }
}

main();
