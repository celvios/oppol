
import pool from '../config/database';
import { ethers } from 'ethers';
import fs from 'fs';

const USDC_ADDRESS = process.env.USDC_CONTRACT || '0x16E4A3d9697D47c61De3bDD1DdDa4148aA09D634';
const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';

const USDC_ABI = [
    'function balanceOf(address account) external view returns (uint256)'
];

async function checkBalances() {
    const logFile = 'debug_balance_log.txt';
    const log = (msg: string) => {
        console.log(msg);
        fs.appendFileSync(logFile, msg + '\n');
    };
    fs.writeFileSync(logFile, '');

    try {
        log('--- Debugging Balance Check (Profile Load) ---');
        log(`RPC URL: ${RPC_URL}`);
        log(`USDC Contract: ${USDC_ADDRESS}`);

        try {
            const provider = new ethers.JsonRpcProvider(RPC_URL);
            await provider.getNetwork();
            log('✅ RPC Connection Successful');
        } catch (e: any) {
            log(`❌ RPC Connection FAILED: ${e.message}`);
            return;
        }

        log('\nFetching users from database...');
        const result = await pool.query('SELECT * FROM telegram_users');
        log(`Found ${result.rows.length} users.`);

        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

        for (const user of result.rows) {
            log(`\nChecking User: ${user.username} (${user.telegram_id})`);
            log(`Wallet: ${user.wallet_address}`);

            try {
                const balance = await usdcContract.balanceOf(user.wallet_address);
                const balanceFormatted = ethers.formatUnits(balance, 6);
                log(`✅ Balance: ${balanceFormatted} USDC`);
            } catch (error: any) {
                log(`❌ Balance Check FAILED: ${error.message}`);
            }
        }

    } catch (error) {
        log(`Debug script error: ${error}`);
    } finally {
        await pool.end();
    }
}

checkBalances();
