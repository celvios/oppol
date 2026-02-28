// Manually triggers the custodial deposit sweep for the Google user
// whose USDC arrived via plain transfer but was never deposited into the market contract.
require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const WALLET = '0x9Ff472aEb3A160A47E00916ce717802A511DE419';

async function run() {
    // 1. Find the user
    const userRes = await pool.query(
        `SELECT u.id as user_id, u.wallet_address, u.privy_user_id, w.public_address as eoa, w.encrypted_private_key
         FROM users u JOIN wallets w ON w.user_id = u.id
         WHERE LOWER(u.wallet_address) = $1`,
        [WALLET.toLowerCase()]
    );

    if (userRes.rows.length === 0) {
        console.error('❌ User not found in DB for wallet:', WALLET);
        await pool.end();
        return;
    }

    const user = userRes.rows[0];
    console.log(`✅ Found user: ${user.user_id}`);
    console.log(`  SA (wallet_address): ${user.wallet_address}`);
    console.log(`  EOA: ${user.eoa}`);
    console.log(`  Privy ID: ${user.privy_user_id}`);

    // 2. Check SA wallet USDC balance
    const { ethers } = require('ethers');
    const provider = new ethers.JsonRpcProvider(process.env.BNB_RPC_URL);
    const USDC = process.env.USDC_CONTRACT || process.env.NEXT_PUBLIC_USDC_ADDRESS;
    const MARKET = process.env.MARKET_CONTRACT || process.env.NEXT_PUBLIC_MARKET_ADDRESS;

    console.log(`\n  USDC Contract: ${USDC}`);
    console.log(`  Market Contract: ${MARKET}`);

    const usdcAbi = ['function balanceOf(address) view returns (uint256)'];
    const marketAbi = ['function userBalances(address) view returns (uint256)'];
    const usdcContract = new ethers.Contract(USDC, usdcAbi, provider);
    const marketContract = new ethers.Contract(MARKET, marketAbi, provider);

    const saUsdcBal = await usdcContract.balanceOf(user.wallet_address);
    const marketBal = await marketContract.userBalances(user.wallet_address);

    console.log(`\n=== BALANCES ===`);
    console.log(`  SA USDC wallet balance: ${ethers.formatUnits(saUsdcBal, 18)} USDC`);
    console.log(`  Market deposited balance: ${ethers.formatUnits(marketBal, 18)} USDC`);

    if (saUsdcBal === 0n) {
        console.log('\n⚠️  SA has no USDC wallet balance to sweep. The deposit may not have arrived at the SA address.');
        console.log('   The raw transfer tx may have sent USDC directly to a different address.');
        await pool.end();
        return;
    }

    // 3. Trigger the sweep via the backend function
    console.log(`\n🚀 Triggering custodial deposit sweep for ${ethers.formatUnits(saUsdcBal, 18)} USDC...`);
    const { processCustodialDeposit } = require('./dist/controllers/walletController');
    const txHash = await processCustodialDeposit(user.user_id, ethers.formatUnits(saUsdcBal, 18), 'manual-fix');
    console.log(`✅ Sweep complete! TX: ${txHash}`);

    await pool.end();
}

run().catch(console.error);
