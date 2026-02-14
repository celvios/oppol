
import { ethers } from 'ethers';
import { query } from '../config/database';
import fs from 'fs';
import dotenv from 'dotenv';
import pool from '../config/database';

// Load env vars
dotenv.config();

const LOG_FILE = 'admin-stats-verification.log';
const log = (msg: string) => {
    console.log(msg);
    fs.appendFileSync(LOG_FILE, msg + '\n');
};

// Clean log file
fs.writeFileSync(LOG_FILE, '');

async function verifyStats() {
    log('--- Verifying Admin Stats Logic ---');

    try {
        // 1. Verify Volume Calculation
        log('\n[1] Checking Volume Column Type...');

        // DEBUG: Check column type
        const schemaRes = await query(`
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_name = 'markets' AND column_name = 'volume'
        `);
        if (schemaRes.rows.length > 0) {
            log(`   Column 'volume' type: ${schemaRes.rows[0].data_type}`);
        } else {
            log(`   ⚠️ Could not determine column type`);
        }

        log('\n[2] Checking Total Volume from DB...');
        // Try simple sum (works if numeric)
        let totalVolumeNum = 0;
        try {
            const volumeRes = await query(`SELECT SUM(volume) as total_volume FROM markets`);
            totalVolumeNum = volumeRes.rows[0].total_volume || 0;
            log('   ✅ SUM(volume) success');
        } catch (e: any) {
            log(`   ⚠️ SUM(volume) failed: ${e.message}`);
            log('   Attempting CAST(volume AS NUMERIC)...');
            const volumeRes = await query(`
                SELECT SUM(CAST(NULLIF(volume, '') AS NUMERIC)) as total_volume 
                FROM markets
            `);
            totalVolumeNum = volumeRes.rows[0].total_volume || 0;
        }

        const totalVolumeFormatted = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(totalVolumeNum);

        log(`   Raw Volume Sum: ${totalVolumeNum}`);
        log(`   Formatted Volume: ${totalVolumeFormatted}`);


        // 3. Verify Liquidity Calculation
        log('\n[3] Checking Total Liquidity from Blockchain...');

        const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org';
        const chainId = Number(process.env.CHAIN_ID) || 56;

        log(`   RPC URL: ${rpcUrl}`);
        log(`   Chain ID: ${chainId}`);

        const MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MARKET_CONTRACT || process.env.MULTI_MARKET_ADDRESS;
        const USDC_ADDR = process.env.NEXT_PUBLIC_USDC_CONTRACT || process.env.USDC_CONTRACT;

        log(`   Market Address: ${MARKET_ADDR}`);
        log(`   USDC Address: ${USDC_ADDR}`);

        if (MARKET_ADDR && USDC_ADDR) {
            const provider = new ethers.JsonRpcProvider(rpcUrl, chainId);
            const erc20ABI = [
                "function balanceOf(address) view returns (uint256)",
                "function decimals() view returns (uint8)"
            ];
            const usdcContract = new ethers.Contract(USDC_ADDR, erc20ABI, provider);

            log('   Fetching balance and decimals...');
            const [balanceWei, decimals] = await Promise.all([
                usdcContract.balanceOf(MARKET_ADDR),
                usdcContract.decimals()
            ]);

            log(`   Token Decimals: ${decimals}`);

            const balanceNum = parseFloat(ethers.formatUnits(balanceWei, decimals));

            const totalLiquidityFormatted = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2
            }).format(balanceNum);

            log(`   Raw Balance (Wei): ${balanceWei.toString()}`);
            log(`   Balance (USDC): ${balanceNum}`);
            log(`   Formatted Liquidity: ${totalLiquidityFormatted}`);
        } else {
            log('   ⚠️ SKIPPING LIQUIDITY CHECK: Missing MARKET_ADDR or USDC_ADDR');
        }

        log('\n✅ Verification Complete');

    } catch (error: any) {
        log(`\n❌ ERROR: ${error.message}`);
        console.error(error);
    } finally {
        await pool.end();
    }
}

verifyStats();
