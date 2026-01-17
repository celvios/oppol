import { query } from '../src/config/database';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = 'http://localhost:3002/api';

async function main() {
    try {
        console.log('🧪 Testing Comments API...');

        // 1. Get a valid user
        const userRes = await query('SELECT wallet_address FROM users WHERE wallet_address IS NOT NULL LIMIT 1');
        if (userRes.rows.length === 0) {
            console.error('❌ No users found to test with.');
            process.exit(1);
        }
        const walletAddress = userRes.rows[0].wallet_address;
        console.log(`👤 Using user: ${walletAddress}`);

        // 2. Post a comment
        const marketId = 1;
        const text = `Test comment ${Date.now()}`;
        console.log(`📝 Posting comment: "${text}"...`);

        try {
            const postRes = await axios.post(`${API_URL}/comments`, {
                marketId,
                text,
                walletAddress
            });
            console.log('✅ Post success:', postRes.data.success);
        } catch (e: any) {
            console.error('❌ Post failed:', e.response?.data || e.message);
        }

        // 3. Fetch comments
        console.log('📥 Fetching comments...');
        try {
            const getRes = await axios.get(`${API_URL}/comments/${marketId}`);
            const comments = getRes.data.comments;
            console.log(`✅ Fetched ${comments.length} comments.`);

            const myComment = comments.find((c: any) => c.text === text);
            if (myComment) {
                console.log('✅ Verified: My comment exists in the list.');
            } else {
                console.error('❌ Verified: My comment NOT found.');
            }
        } catch (e: any) {
            console.error('❌ Fetch failed:', e.response?.data || e.message);
        }

    } catch (e) {
        console.error('Global error:', e);
    }
}

main();
