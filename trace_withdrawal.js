
const { ethers } = require('ethers');
const { Client } = require('pg');
require('dotenv').config();

// Config
const DESTINATION_ADDR = '0xE434423371E3AacAF0fF8fC0B3Ef1F521e82CCC1'; // User provided receiver
const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org';
const USDC_ADDR = process.env.NEXT_PUBLIC_USDC_CONTRACT;
const MARKETS_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS;

async function main() {
    console.log('--- tracing withdrawal ---');
    console.log(`Target Receiver: ${DESTINATION_ADDR}`);
    console.log(`RPC: ${RPC_URL}`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();

    // 1. Find User who matches this destination? 
    // Or just look for any custodial wallet that might have interacted with this address?
    // Actually, we don't know the custodial address easily unless we query via the user ID.
    // Let's search for the custodial wallet that owes this destination or just check ALL custodial wallets for recent activity?
    // Better: The user just did it. Let's look for wallets with USDC balance > 0 (stuck funds).

    const res = await client.query('SELECT user_id, public_address, encrypted_private_key FROM wallets');
    console.log(`Checking ${res.rows.length} custodial wallets for stuck funds...`);

    const usdc = new ethers.Contract(USDC_ADDR, ['function balanceOf(address) view returns (uint256)'], provider);

    for (const row of res.rows) {
        const addr = row.public_address;
        try {
            const bal = await usdc.balanceOf(addr);
            if (bal > 0n) {
                const balFormatted = ethers.formatUnits(bal, 6); // USDC 6 decimals
                console.log(`\n⚠️  FOUND STUCK USDC!`);
                console.log(`   Custodial Wallet: ${addr}`);
                console.log(`   User ID: ${row.user_id}`);
                console.log(`   Balance: ${balFormatted} USDC`);

                // Check BNB too
                const bnb = await provider.getBalance(addr);
                console.log(`   BNB Balance: ${ethers.formatEther(bnb)}`);

                if (bnb < ethers.parseEther("0.0005")) {
                    console.log('   🔴 LOW GAS! This explains why transfer failed.');
                }
            }
        } catch (e) {
            console.error(`Status check failed for ${addr}:`, e.message);
        }
    }

    // Check Destination Wallet as well
    const destBal = await usdc.balanceOf(DESTINATION_ADDR);
    console.log(`\n==========================================`);
    console.log(`DESTINATION BALANCE (${DESTINATION_ADDR})`);
    console.log(`${ethers.formatUnits(destBal, 6)} USDC`);
    console.log(`==========================================\n`);

    // Also check the specific wallet from user logs if possible
    // "0xD5E..." from logs?
    const USER_CUSTODIAL = '0xD5EeB48921F15Cdc0863fAA841fc08F998b9e55f';
    const custBal = await usdc.balanceOf(USER_CUSTODIAL);
    console.log(`CUSTODIAL BALANCE (${USER_CUSTODIAL})`);
    console.log(`${ethers.formatUnits(custBal, 6)} USDC`);
    console.log(`BNB: ${ethers.formatEther(await provider.getBalance(USER_CUSTODIAL))}`);

    await client.end();
}

main().catch(console.error);
