
const { Client } = require('pg');
const { ethers } = require('ethers');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;
const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org/';
const USDT_ADDR = process.env.NEXT_PUBLIC_USDT_CONTRACT || '0x55d398326f99059fF775485246999027B3197955';

async function main() {
    console.log('Connecting to DB...');
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();

    console.log('Querying wallets...');
    const res = await client.query('SELECT user_id, public_address FROM wallets');
    console.log(`Found ${res.rows.length} wallets.`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const usdtAbi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
    const usdt = new ethers.Contract(USDT_ADDR, usdtAbi, provider);

    console.log('Checking balances...');
    for (const row of res.rows) {
        try {
            const bal = await usdt.balanceOf(row.public_address);
            // USDT on BSC is 18 decimals usually? Let's check.
            // Wait, common USDT on BSC is 18.
            const decimals = await usdt.decimals().catch(() => 18);
            const formatted = ethers.formatUnits(bal, decimals);

            if (parseFloat(formatted) > 0) {
                console.log(`\n💰 FOUND USDT!`);
                console.log(`User ID: ${row.user_id}`);
                console.log(`Address: ${row.public_address}`);
                console.log(`Balance: ${formatted} USDT`);
                console.log('--------------------------');
            } else {
                process.stdout.write('.');
            }
        } catch (e) {
            console.error(`Error checking ${row.public_address}:`, e.message);
        }
    }
    console.log('\nDone.');
    await client.end();
}

main().catch(console.error);
