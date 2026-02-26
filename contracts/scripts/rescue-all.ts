/**
 * Full rescue: 
 * 1. Read all wallet users from DB
 * 2. Check balances on old market
 * 3. emergencyAdminWithdraw each one
 * 4. depositFor into new market
 *
 * Run: npx hardhat run scripts/rescue-all.ts --network bsc
 */
import { ethers } from "hardhat";
import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config();

const OLD_MARKET = "0xe5a5320b3764Bd8FFFd95cF7aA7F406DaC2B070C";
const NEW_MARKET = process.env.NEXT_PUBLIC_MARKET_ADDRESS!;
const USDC = process.env.NEXT_PUBLIC_USDC_CONTRACT!;

const ABI = [
    "function userBalances(address) view returns (uint256)",
    "function emergencyAdminWithdraw(address) external",
    "function depositFor(address, uint256) external",
    "function owner() view returns (address)",
];
const ERC20 = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
    "function allowance(address,address) view returns (uint256)",
];

async function main() {
    const [admin] = await ethers.getSigners();
    console.log("\n━━━ RESCUE ALL STUCK FUNDS ━━━");
    console.log("Admin:      ", admin.address);
    console.log("Old Market: ", OLD_MARKET);
    console.log("New Market: ", NEW_MARKET);

    const oldMkt = new ethers.Contract(OLD_MARKET, ABI, admin);
    const newMkt = new ethers.Contract(NEW_MARKET, ABI, admin);
    const usdc = new ethers.Contract(USDC, ERC20, admin);

    // Verify admin is owner
    const owner = await oldMkt.owner();
    if (owner.toLowerCase() !== admin.address.toLowerCase()) {
        console.error("❌ Not owner of old market:", owner);
        process.exit(1);
    }
    console.log("✅ Ownership verified\n");

    // ── Get all wallet users from DB ──
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const { rows } = await pool.query(
        `SELECT DISTINCT wallet_address FROM users WHERE wallet_address IS NOT NULL AND wallet_address != '' AND wallet_address LIKE '0x%'`
    );
    await pool.end();
    const addresses: string[] = rows.map((r: any) => r.wallet_address as string);
    console.log(`Found ${addresses.length} wallet users in DB\n`);

    // ── Check balances on old market ──
    type UserBal = { addr: string; bal: bigint; fmt: string };
    const stuck: UserBal[] = [];
    for (const addr of addresses) {
        try {
            const bal: bigint = await oldMkt.userBalances(addr);
            if (bal > 0n) {
                stuck.push({ addr, bal, fmt: ethers.formatUnits(bal, 18) });
                console.log(`  💰 ${addr}: ${ethers.formatUnits(bal, 18)} USDC stuck`);
            }
        } catch { }
    }

    if (stuck.length === 0) {
        console.log("✅ No stuck funds found for DB users.");

        // Check raw USDC balance remaining  
        const rawBal = await usdc.balanceOf(OLD_MARKET);
        console.log(`Old market raw USDC balance: ${ethers.formatUnits(rawBal, 18)} — this may be LP/subsidy.`);
        return;
    }

    const totalWei = stuck.reduce((a, b) => a + b.bal, 0n);
    console.log(`\nTotal to rescue: ${ethers.formatUnits(totalWei, 18)} USDC across ${stuck.length} users\n`);

    // ── Emergency withdraw to admin ──
    console.log("─ Calling emergencyAdminWithdraw... ─");
    for (const u of stuck) {
        try {
            const tx = await oldMkt.emergencyAdminWithdraw(u.addr);
            await tx.wait();
            console.log(`  ✅ Rescued ${u.fmt} from ${u.addr} | TX: ${tx.hash}`);
        } catch (e: any) {
            console.error(`  ❌ ${u.addr}: ${e.message?.slice(0, 120)}`);
        }
    }

    // ── Re-deposit into new market for each user ──
    console.log("\n─ Re-depositing into new market... ─");
    const allow: bigint = await usdc.allowance(admin.address, NEW_MARKET);
    if (allow < totalWei) {
        const tx = await usdc.approve(NEW_MARKET, ethers.MaxUint256);
        await tx.wait();
        console.log("  Approved USDC for new market ✅");
    }

    for (const u of stuck) {
        try {
            const tx = await newMkt.depositFor(u.addr, u.bal);
            await tx.wait();
            console.log(`  ✅ Deposited ${u.fmt} for ${u.addr} | TX: ${tx.hash}`);
        } catch (e: any) {
            console.error(`  ❌ depositFor ${u.addr}: ${e.message?.slice(0, 120)}`);
        }
    }

    console.log("\n━━━ COMPLETE ━━━\n");
}

main().catch(console.error);
