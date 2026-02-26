/**
 * Rescue ALL stuck USDC from old market.
 * Funds go to owner wallet (0xfa6BFaF9...).
 * 
 * Requires: RESCUE_KEY in .env (admin private key)
 * Run: npx ts-node scripts/rescue-all-simple.ts
 */
import { ethers } from 'ethers';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const OLD_MARKET = '0xe5a5320b3764Bd8FFFd95cF7aA7F406DaC2B070C';
const RPC_URL = process.env.BNB_RPC_URL!;
const RESCUE_KEY = (process.env.RESCUE_KEY || process.env.PRIVATE_KEY)?.trim();

if (!RESCUE_KEY) {
    console.error('❌ Set RESCUE_KEY in .env first!');
    process.exit(1);
}

const MARKET_ABI = [
    'function userBalances(address) view returns (uint256)',
    'function emergencyAdminWithdraw(address) external',
    'function owner() view returns (address)',
];
const ERC20_ABI = [
    'function balanceOf(address) view returns (uint256)',
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(RESCUE_KEY!, provider);

    console.log('\n━━━ RESCUE ALL STUCK FUNDS ━━━');
    console.log('Admin:      ', signer.address);
    console.log('Old Market: ', OLD_MARKET);

    const market = new ethers.Contract(OLD_MARKET, MARKET_ABI, signer);
    const usdc = new ethers.Contract('0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', ERC20_ABI, provider);

    // Verify ownership
    const owner = await market.owner();
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
        console.error(`❌ Not owner. Owner is: ${owner}, You are: ${signer.address}`);
        process.exit(1);
    }
    console.log('✅ Ownership confirmed\n');

    // Get all wallet users from DB
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const { rows } = await pool.query(
        `SELECT DISTINCT wallet_address FROM users WHERE wallet_address IS NOT NULL AND wallet_address != '' AND wallet_address ILIKE '0x%'`
    );
    await pool.end();
    const addresses: string[] = rows.map((r: any) => r.wallet_address);
    console.log(`Checking ${addresses.length} wallet users from DB...\n`);

    // Find who has balance in old market
    const stuck: { addr: string; bal: bigint }[] = [];
    for (const addr of addresses) {
        try {
            const bal: bigint = await market.userBalances(addr);
            if (bal > 0n) {
                stuck.push({ addr, bal });
                console.log(`  💰 ${addr}: ${ethers.formatUnits(bal, 18)} USDC`);
            }
        } catch { }
    }

    if (stuck.length === 0) {
        const raw = await usdc.balanceOf(OLD_MARKET);
        console.log(`\nNo DB users found with stuck funds.`);
        console.log(`Old market still holds ${ethers.formatUnits(raw, 18)} USDC (may be LP/fees, not user balances).`);
        return;
    }

    const total = stuck.reduce((a, b) => a + b.bal, 0n);
    console.log(`\nTotal: ${ethers.formatUnits(total, 18)} USDC across ${stuck.length} users`);
    console.log(`All funds will be sent to: ${signer.address}\n`);

    // Emergency withdraw each user → funds land in admin wallet
    for (const u of stuck) {
        try {
            console.log(`Rescuing ${ethers.formatUnits(u.bal, 18)} from ${u.addr}...`);
            const tx = await market.emergencyAdminWithdraw(u.addr);
            await tx.wait();
            console.log(`  ✅ TX: ${tx.hash}`);
        } catch (e: any) {
            console.error(`  ❌ ${u.addr}: ${e.message?.slice(0, 150)}`);
        }
    }

    const finalBal = await usdc.balanceOf(signer.address);
    console.log(`\n✅ Done! Admin wallet USDC: ${ethers.formatUnits(finalBal, 18)}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);
