
import { query } from './src/config/database';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const USDT_ADDR = process.env.NEXT_PUBLIC_USDT_CONTRACT || '0x55d398326f99059fF775485246999027B3197955';
const RPC_URL = process.env.BNB_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed.binance.org/';

async function main() {
    console.log('Checking USDT balances for custodial wallets...');
    console.log('RPC:', RPC_URL);

    const result = await query('SELECT user_id, public_address FROM wallets');
    console.log(`Found ${result.rows.length} wallets.`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const usdtAbi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
    const usdt = new ethers.Contract(USDT_ADDR, usdtAbi, provider);

    for (const row of result.rows) {
        try {
            const bal = await usdt.balanceOf(row.public_address);
            const decimals = await usdt.decimals().catch(() => 18);
            const formatted = ethers.formatUnits(bal, decimals);

            if (parseFloat(formatted) > 0) {
                console.log(`\n💰 FOUND USDT!`);
                console.log(`User: ${row.user_id}`);
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
    process.exit(0);
}

main();
