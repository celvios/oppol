
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import pool from '../src/config/database';

dotenv.config();

const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
// Hardcoded Correct Address
const MARKET_ADDRESS = '0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6';
const ABI = [
    'function marketCount() view returns (uint256)',
    'function getMarketBasicInfo(uint256) view returns (string, uint256, uint256, uint256, bool, uint256)',
    'function getMarketOutcomes(uint256) view returns (string[])'
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(MARKET_ADDRESS, ABI, provider);

    console.log('🔗 Connected to:', MARKET_ADDRESS);

    // 1. Get Chain Data
    const count = await contract.marketCount();
    console.log(`📡 Found ${count} markets on chain.`);

    const markets = [];
    for (let i = 0; i < Number(count); i++) {
        try {
            const info = await contract.getMarketBasicInfo(i);
            const question = info[0];
            const timestamp = Number(info[2]);
            const outcomes = await contract.getMarketOutcomes(i);

            // Map category (approximate or default)
            let category = 'Technology';
            if (question.includes('BTC') || question.includes('ETH') || question.includes('SOL')) category = 'Crypto';
            if (question.includes('win') || question.includes('FIFA')) category = 'Sports';

            markets.push({
                id: i,
                question,
                outcomes: JSON.stringify(outcomes),
                end_time: new Date(timestamp * 1000).toISOString(),
                category
            });
            console.log(`   - Fetched #${i}: ${question.substring(0, 30)}...`);
        } catch (e) {
            console.error(`ERROR fetching market #${i}:`, e);
        }
    }

    // 2. Sync DB
    console.log('💾 Syncing to Database...');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Clear existing
        await client.query('TRUNCATE TABLE markets CASCADE');
        console.log('   - Cleared existing markets.');

        // Insert new
        for (const m of markets) {
            await client.query(
                `INSERT INTO markets (market_id, question, description, category, image) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    m.id,
                    m.question,
                    'Synced from Chain', // Description 
                    m.category,
                    'https://placehold.co/600x400' // Default image
                ]
            );
        }

        await client.query('COMMIT');
        console.log('✅ Sync Complete!');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Sync Failed:', e);
    } finally {
        client.release();
        process.exit(0);
    }
}

main();
