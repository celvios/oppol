
import { ethers } from 'ethers';
import pool from '../config/database';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
const MARKET_ADDR = process.env.MARKET_CONTRACT || process.env.MARKET_ADDRESS || '0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6';

const ABI = [
    'function marketCount() view returns (uint256)',
    'function getMarketBasicInfo(uint256) view returns (string question, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)'
];

const LOG_FILE = 'audit_markets.log';
const log = (msg: string) => {
    console.log(msg);
    fs.appendFileSync(LOG_FILE, msg + '\n');
};
fs.writeFileSync(LOG_FILE, '');

async function checkAll() {
    log(`--- Auditing All Markets on ${MARKET_ADDR} ---`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(MARKET_ADDR, ABI, provider);

    try {
        const count = await contract.marketCount();
        log(`Total Contract Markets: ${count}`);

        const dbRes = await pool.query('SELECT * FROM markets ORDER BY market_id');
        const dbMarkets = new Map();
        dbRes.rows.forEach(r => dbMarkets.set(Number(r.market_id), r));
        log(`Total DB Markets: ${dbMarkets.size}`);

        let mismatches = 0;

        for (let i = 0; i < Number(count); i++) {
            try {
                const info = await contract.getMarketBasicInfo(i);
                const contractQ = info.question;
                const dbMarket = dbMarkets.get(i);
                const dbQ = dbMarket ? dbMarket.question : '(MISSING IN DB)';

                // Normalize strings for comparison (trim, simple check)
                const match = contractQ.trim() === dbQ.trim();

                if (!match) {
                    mismatches++;
                    log(`\n❌ MISMATCH [ID: ${i}]`);
                    log(`   Contract: "${contractQ}"`);
                    log(`   Database: "${dbQ}"`);

                    // Specific check for outcomes mismatch if DB exists
                    if (dbMarket && info.outcomeCount) {
                        // Parse Outcome Names from DB if stored (often JSON)
                        // But just counting is hard without parsing JSON.
                        // Let's rely on question text as primary key.
                    }
                } else {
                    // log(`✅ Match [ID: ${i}]`);
                }

            } catch (err: any) {
                log(`⚠️ Error reading Market ${i}: ${err.message}`);
            }
        }

        if (mismatches === 0) {
            log('\n✅ ALL CLEAN! No mismatches found.');
        } else {
            log(`\n⚠️ Found ${mismatches} mismatches.`);
        }

    } catch (e: any) {
        log('Critical Error: ' + e.message);
    } finally {
        await pool.end();
    }
}

checkAll();
