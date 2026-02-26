/**
 * Diagnostic: Reads the market address the Zap contract is pointing to
 * and compares it to the current NEXT_PUBLIC_MARKET_ADDRESS.
 * 
 * Run: npx ts-node -e "require('dotenv').config({path:'.env'})" scripts/check-zap-market.ts
 * Or:  npx ts-node scripts/check-zap-market.ts
 */
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
dotenv.config();

const ZAP_ADDRESS = process.env.NEXT_PUBLIC_ZAP_ADDRESS || '0xD6908f3E5FC9f4189d18f30B2fD61E278dC8D694';
const MARKET_ADDRESS = process.env.NEXT_PUBLIC_MARKET_ADDRESS || '';
const RPC_URL = process.env.BNB_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed1.binance.org/';

const ZAP_ABI = [
    'function market() view returns (address)',
    'function usdc()   view returns (address)',
    'function router() view returns (address)',
];

const MARKET_ABI = [
    'function userBalances(address) view returns (uint256)',
];

// Test wallet from the error report
const TEST_WALLET = '0x0ff7e81Cb052243ECf72d19D63e0d4268fa26eC9';

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const zap = new ethers.Contract(ZAP_ADDRESS, ZAP_ABI, provider);

    const zapMarket = await zap.market();
    const zapUsdc = await zap.usdc();

    console.log('\n━━━ ZAP CONTRACT DIAGNOSTIC ━━━');
    console.log(`Zap address   : ${ZAP_ADDRESS}`);
    console.log(`Zap.market()  : ${zapMarket}`);
    console.log(`Zap.usdc()    : ${zapUsdc}`);
    console.log(`NEXT_PUBLIC_MARKET_ADDRESS : ${MARKET_ADDRESS}`);

    const match = zapMarket.toLowerCase() === MARKET_ADDRESS.toLowerCase();
    console.log(`\n${match ? '✅ MATCH' : '❌ MISMATCH'}: Zap market ${match ? '==' : '!='} env market`);

    if (!match) {
        console.log('\n🚨 ROOT CAUSE CONFIRMED:');
        console.log('  The Zap contract deposits into the OLD market:', zapMarket);
        console.log('  The app reads balances from the NEW market:  ', MARKET_ADDRESS);
        console.log('  Funds are landing in the wrong contract!\n');
    }

    // Check the user's balance on BOTH markets
    console.log(`\n━━━ User Balance Check (${TEST_WALLET}) ━━━`);
    const mkt1 = new ethers.Contract(MARKET_ADDRESS, MARKET_ABI, provider);
    const bal1 = await mkt1.userBalances(TEST_WALLET).catch(() => 0n);
    console.log(`Current market (${MARKET_ADDRESS}) : ${ethers.formatUnits(bal1, 18)} USDC`);

    if (!match) {
        const mkt2 = new ethers.Contract(zapMarket, MARKET_ABI, provider);
        const bal2 = await mkt2.userBalances(TEST_WALLET).catch(() => 0n);
        console.log(`Old market    (${zapMarket}) : ${ethers.formatUnits(bal2, 18)} USDC`);
        if (bal2 > 0n) {
            console.log('\n💰 Funds found in old market. Need to update Zap or migrate.');
        }
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);
