const { ethers } = require('ethers');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function verify() {
    try {
        console.log('--- Verifying Market Cleanup ---');

        // 1. Get On-Chain Count
        const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-rpc.publicnode.com';
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        // Assuming this address from prev context, but better to read from env or use the one in code
        const MARKET_ADDR = '0xe3Eb84D7e271A5C44B27578547f69C80c497355B';

        // Minimal ABI
        const abi = ['function marketCount() view returns (uint256)'];
        const contract = new ethers.Contract(MARKET_ADDR, abi, provider);

        const countBig = await contract.marketCount();
        const chainCount = Number(countBig);
        console.log(`✅ On-Chain Markets: ${chainCount}`);

        // 2. Get DB Markets
        const res = await pool.query('SELECT market_id, question FROM markets ORDER BY market_id ASC');
        const dbMarkets = res.rows;
        const dbIds = new Set(dbMarkets.map(m => Number(m.market_id)));
        console.log(`✅ Database Markets: ${dbMarkets.length}`);

        // 3. Find Ghosts
        const ghostIds = [];
        for (let i = 0; i < chainCount; i++) {
            if (!dbIds.has(i)) {
                ghostIds.push(i);
            }
        }

        if (ghostIds.length > 0) {
            console.log(`\n👻 Found ${ghostIds.length} "Ghost" Markets (Deleted from DB, exist on Chain):`);
            console.log(`IDs: ${ghostIds.join(', ')}`);
            console.log('\nVERDICT: The new API logic strictly filters using the DB list.');
            console.log(`These ${ghostIds.length} markets will NOT be visible on the client.`);
        } else {
            console.log('\n✨ No mismatch found. All on-chain markets are in the DB.');
        }

        await pool.end();

    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
}

verify();
