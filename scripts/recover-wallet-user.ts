/**
 * WALLET USER RECOVERY — Old Market Fund Rescue
 * 
 * Each wallet user can withdraw their own stuck balance.
 * The old market's withdraw() works for msg.sender directly.
 * 
 * Add RESCUE_KEY=<user's private key> to .env, then run:
 *   npx ts-node --project tsconfig.json scripts/recover-wallet-user.ts
 * 
 * ⚠️  CUSTODIAL USER REMINDER: Custodial users need recover-custodial-users.ts
 */
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
dotenv.config();

const OLD_MARKET = '0xe5a5320b3764Bd8FFFd95cF7aA7F406DaC2B070C';
const NEW_MARKET = process.env.NEXT_PUBLIC_MARKET_ADDRESS!;
const USDC = process.env.NEXT_PUBLIC_USDC_CONTRACT!;
const RPC_URL = process.env.BNB_RPC_URL!;

const RESCUE_KEY = (process.env.RESCUE_KEY || process.env.PRIVATE_KEY)?.trim();
if (!RESCUE_KEY) { console.error('❌ Set RESCUE_KEY in .env'); process.exit(1); }

const OLD_MARKET_ABI = [
    'function userBalances(address) view returns (uint256)',
    'function withdraw(uint256 amount) external',
];
const NEW_MARKET_ABI = [
    'function deposit(uint256 amount) external',
];
const ERC20_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function approve(address,uint256) returns (bool)',
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(RESCUE_KEY!, provider);

    console.log('\n━━━ WALLET USER RECOVERY ━━━');
    console.log('User:        ', wallet.address);
    console.log('Old Market:  ', OLD_MARKET);
    console.log('New Market:  ', NEW_MARKET);

    const oldMkt = new ethers.Contract(OLD_MARKET, OLD_MARKET_ABI, wallet);
    const newMkt = new ethers.Contract(NEW_MARKET, NEW_MARKET_ABI, wallet);
    const usdc = new ethers.Contract(USDC, ERC20_ABI, wallet);

    // Check balance on old market
    const stuck: bigint = await oldMkt.userBalances(wallet.address);
    console.log(`\nStuck in old market: ${ethers.formatUnits(stuck, 18)} USDC`);

    if (stuck === 0n) {
        console.log('✅ No stuck funds for this wallet. Nothing to do.');
        return;
    }

    // Step 1: Withdraw from old market → USDC lands in wallet
    console.log('\n─ Step 1: Withdrawing from old market... ─');
    const withdrawTx = await oldMkt.withdraw(stuck);
    await withdrawTx.wait();
    console.log(`✅ Withdrawn! TX: ${withdrawTx.hash}`);

    // Step 2: Approve + deposit into new market
    console.log('\n─ Step 2: Depositing into new market... ─');
    const approveTx = await usdc.approve(NEW_MARKET, stuck);
    await approveTx.wait();
    console.log('✅ Approved');

    const depositTx = await newMkt.deposit(stuck);
    await depositTx.wait();
    console.log(`✅ Deposited into new market! TX: ${depositTx.hash}`);

    const newBal = await oldMkt.userBalances(wallet.address);
    console.log(`\nOld market balance: ${ethers.formatUnits(newBal, 18)} (should be 0)`);
    console.log('\n━━━ DONE ━━━\n');

    console.log('\n⚠️  REMINDER: Run recover-custodial-users.ts to recover custodial user funds!');
}

main().catch(console.error);
