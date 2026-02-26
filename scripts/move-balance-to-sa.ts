/**
 * MOVE BALANCE: EOA → SA
 * 
 * The recovery script deposited $1.25 under the EOA (0x0ff7e81...),
 * but trades are sent from the Pimlico SA (0xbFEd4943...).
 * 
 * This script:
 *   1. Withdraws from market as EOA → USDC lands in EOA wallet
 *   2. Approves market to spend USDC
 *   3. Calls depositFor(SA, amount) → balance now under SA
 * 
 * After this, the trading terminal can trade normally.
 * 
 * Run: npx ts-node --project tsconfig.json scripts/move-balance-to-sa.ts
 */
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
dotenv.config();

const MARKET = process.env.NEXT_PUBLIC_MARKET_ADDRESS!;
const USDC = process.env.NEXT_PUBLIC_USDC_CONTRACT!;
const RPC_URL = process.env.BNB_RPC_URL!;
const KEY = (process.env.RESCUE_KEY || process.env.PRIVATE_KEY)?.trim();

// The Pimlico SA address for this EOA (from the error log)
const SA_ADDRESS = '0xbFEd4943C73b3cBB47c8d74596f64F76D926b3B8';

if (!KEY) { console.error('❌ Set RESCUE_KEY in .env'); process.exit(1); }

const MARKET_ABI = [
    'function userBalances(address) view returns (uint256)',
    'function withdraw(uint256 amount) external',
    'function depositFor(address beneficiary, uint256 amount) external',
];
const ERC20_ABI = [
    'function approve(address,uint256) returns (bool)',
    'function balanceOf(address) view returns (uint256)',
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(KEY!, provider);

    console.log('\n━━━ MOVE BALANCE: EOA → SA ━━━');
    console.log('EOA:     ', wallet.address);
    console.log('SA:      ', SA_ADDRESS);
    console.log('Market:  ', MARKET);

    const market = new ethers.Contract(MARKET, MARKET_ABI, wallet);
    const usdc = new ethers.Contract(USDC, ERC20_ABI, wallet);

    // Check current balances
    const eoaBal: bigint = await market.userBalances(wallet.address);
    const saBal: bigint = await market.userBalances(SA_ADDRESS);

    console.log(`\nEOA market balance: ${ethers.formatUnits(eoaBal, 18)} USDC`);
    console.log(`SA market balance:  ${ethers.formatUnits(saBal, 18)} USDC`);

    if (eoaBal === BigInt(0)) {
        console.log('\n✅ EOA has no balance to move. Nothing to do.');
        return;
    }

    // Step 1: Withdraw from market → USDC to EOA wallet
    console.log('\n─ Step 1: Withdrawing from market... ─');
    const withdrawTx = await market.withdraw(eoaBal);
    await withdrawTx.wait();
    console.log(`✅ Withdrawn! TX: ${withdrawTx.hash}`);

    // Step 2: Approve market to spend USDC
    console.log('\n─ Step 2: Approving market... ─');
    const approveTx = await usdc.approve(MARKET, eoaBal);
    await approveTx.wait();
    console.log('✅ Approved');

    // Step 3: depositFor(SA, amount) → balance now under SA
    console.log('\n─ Step 3: Depositing for SA... ─');
    const depositTx = await market.depositFor(SA_ADDRESS, eoaBal);
    await depositTx.wait();
    console.log(`✅ Deposited for SA! TX: ${depositTx.hash}`);

    // Verify
    const newEoaBal: bigint = await market.userBalances(wallet.address);
    const newSaBal: bigint = await market.userBalances(SA_ADDRESS);
    console.log(`\nEOA market balance: ${ethers.formatUnits(newEoaBal, 18)} (should be 0)`);
    console.log(`SA market balance:  ${ethers.formatUnits(newSaBal, 18)} (should be ~1.25)`);
    console.log('\n━━━ DONE ━━━\n');
}

main().catch(console.error);
