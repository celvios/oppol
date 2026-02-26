/**
 * Recover ALL funds stuck in the old market contract.
 * 
 * The old market (0xe5a5320) received deposits from the misconfigured Zap.
 * This script:
 *  1. Scans Deposited events to find all users with balances
 *  2. Reads each user's userBalances
 *  3. Calls emergencyAdminWithdraw(user) to pull funds to owner
 *  4. Deposits the rescued USDC into the NEW market for each user via depositFor
 *
 * Run:  npx hardhat run scripts/recover-old-market.ts --network bsc
 */
import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

const OLD_MARKET = "0xe5a5320b3764Bd8FFFd95cF7aA7F406DaC2B070C";
const NEW_MARKET = process.env.NEXT_PUBLIC_MARKET_ADDRESS || "0x224960Ccf500CfECba7DF579772067BF2390d259";
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_CONTRACT || "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";

const MARKET_ABI = [
    "function userBalances(address) view returns (uint256)",
    "function emergencyAdminWithdraw(address targetUser) external",
    "function depositFor(address beneficiary, uint256 amount) external",
    "function deposit(uint256 amount) external",
    "function owner() view returns (address)",
];

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
    "function allowance(address,address) view returns (uint256)",
];

const DEPOSITED_EVENT_ABI = [
    "event Deposited(address indexed user, uint256 amount)",
    "event Withdrawn(address indexed user, uint256 amount)",
];

async function main() {
    const [admin] = await ethers.getSigners();
    console.log("\n━━━ OLD MARKET FUND RECOVERY ━━━");
    console.log("Admin:      ", admin.address);
    console.log("Old Market: ", OLD_MARKET);
    console.log("New Market: ", NEW_MARKET);
    console.log("USDC:       ", USDC_ADDRESS);

    const oldMarket = new ethers.Contract(OLD_MARKET, MARKET_ABI, admin);
    const newMarket = new ethers.Contract(NEW_MARKET, MARKET_ABI, admin);
    const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, admin);

    // Verify ownership
    const owner = await oldMarket.owner();
    console.log("Old Market Owner:", owner);
    if (owner.toLowerCase() !== admin.address.toLowerCase()) {
        console.error("❌ You are NOT the owner of the old market! Cannot rescue.");
        return;
    }
    console.log("✅ You are the owner.\n");

    // ── Step 1: Scan for all depositors via Deposited events ──
    console.log("─ Scanning for all depositors... ─");
    const eventIface = new ethers.Interface(DEPOSITED_EVENT_ABI);
    const depositedTopic = eventIface.getEvent("Deposited")!.topicHash;

    const provider = admin.provider!;
    const currentBlock = await provider.getBlockNumber();

    // Scan in chunks to avoid RPC limits
    const START_BLOCK = 40000000; // Approximate deploy block
    const CHUNK = 10000;
    const uniqueAddresses = new Set<string>();

    for (let from = START_BLOCK; from <= currentBlock; from += CHUNK) {
        const to = Math.min(from + CHUNK - 1, currentBlock);
        try {
            const logs = await provider.getLogs({
                address: OLD_MARKET,
                topics: [depositedTopic],
                fromBlock: from,
                toBlock: to,
            });
            for (const log of logs) {
                const parsed = eventIface.parseLog({ topics: log.topics as string[], data: log.data });
                if (parsed) {
                    uniqueAddresses.add(parsed.args.user);
                }
            }
        } catch {
            // If chunk too large, try smaller
            try {
                for (let f2 = from; f2 <= to; f2 += 2000) {
                    const t2 = Math.min(f2 + 1999, to);
                    const logs = await provider.getLogs({
                        address: OLD_MARKET,
                        topics: [depositedTopic],
                        fromBlock: f2,
                        toBlock: t2,
                    });
                    for (const log of logs) {
                        const parsed = eventIface.parseLog({ topics: log.topics as string[], data: log.data });
                        if (parsed) uniqueAddresses.add(parsed.args.user);
                    }
                }
            } catch (e2) {
                console.warn(`  ⚠ Skipped blocks ${from}-${to}`);
            }
        }
    }

    console.log(`Found ${uniqueAddresses.size} unique addresses.\n`);

    // ── Step 2: Check balances ──
    console.log("─ Checking balances... ─");
    interface UserBal { address: string; balance: bigint; formatted: string; }
    const usersWithBalance: UserBal[] = [];

    for (const addr of uniqueAddresses) {
        const bal: bigint = await oldMarket.userBalances(addr);
        if (bal > 0n) {
            const formatted = ethers.formatUnits(bal, 18);
            usersWithBalance.push({ address: addr, balance: bal, formatted });
            console.log(`  💰 ${addr}: ${formatted} USDC`);
        }
    }

    if (usersWithBalance.length === 0) {
        console.log("\n✅ No funds to rescue. All clean!");
        return;
    }

    const totalWei = usersWithBalance.reduce((a, b) => a + b.balance, 0n);
    console.log(`\nTotal to rescue: ${ethers.formatUnits(totalWei, 18)} USDC across ${usersWithBalance.length} users\n`);

    // ── Step 3: Emergency withdraw (pulls to admin) ──
    console.log("─ Rescuing funds (emergencyAdminWithdraw)... ─");
    for (const u of usersWithBalance) {
        try {
            console.log(`  Rescuing ${u.formatted} from ${u.address}...`);
            const tx = await oldMarket.emergencyAdminWithdraw(u.address);
            await tx.wait();
            console.log(`  ✅ Rescued! TX: ${tx.hash}`);
        } catch (e: any) {
            console.error(`  ❌ Failed for ${u.address}: ${e.message}`);
        }
    }

    // ── Step 4: Re-deposit into NEW market for each user ──
    console.log("\n─ Re-depositing into new market... ─");

    // First approve new market to spend our USDC
    const adminUsdcBal = await usdc.balanceOf(admin.address);
    console.log(`Admin USDC balance: ${ethers.formatUnits(adminUsdcBal, 18)}`);

    const currentAllowance = await usdc.allowance(admin.address, NEW_MARKET);
    if (currentAllowance < totalWei) {
        console.log("  Approving new market to spend USDC...");
        const approveTx = await usdc.approve(NEW_MARKET, ethers.MaxUint256);
        await approveTx.wait();
        console.log("  ✅ Approved");
    }

    for (const u of usersWithBalance) {
        try {
            console.log(`  Depositing ${u.formatted} for ${u.address}...`);
            const tx = await newMarket.depositFor(u.address, u.balance);
            await tx.wait();
            console.log(`  ✅ Deposited! TX: ${tx.hash}`);
        } catch (e: any) {
            console.error(`  ❌ Failed for ${u.address}: ${e.message}`);
        }
    }

    console.log("\n━━━ RECOVERY COMPLETE ━━━\n");
}

main().catch(console.error);
