const { Client } = require('pg');
const { ethers } = require('ethers');
require('dotenv').config();

const TARGET_WALLET = '0x3B6a79d61523631473CF80d3845E9e6A0B11e5a4';

async function main() {
    // 1. Check Testnet Balance
    console.log('--- TESTNET CHECK ---');
    try {
        const testnetProvider = new ethers.JsonRpcProvider('https://bsc-testnet.publicnode.com');
        const balance = await testnetProvider.getBalance(TARGET_WALLET);
        console.log(`Testnet BNB: ${ethers.formatEther(balance)}`);
    } catch (e) {
        console.log('Testnet check failed:', e.message);
    }

    // 2. Dump Wallets Table
    console.log('\n--- DB WALLETS SAMPLE ---');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query('SELECT id, public_address, created_at FROM wallets ORDER BY created_at DESC LIMIT 5');
        console.log(res.rows);

        const count = await client.query('SELECT COUNT(*) FROM wallets');
        console.log(`Total wallets: ${count.rows[0].count}`);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

main();
