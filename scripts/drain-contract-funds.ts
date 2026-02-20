/**
 * drain-contract-funds.ts
 * 
 * Pre-launch fund recovery script:
 * 1. Claims accumulated protocol fees → owner wallet
 * 2. Shows all user balances still in contract
 * 3. Performs emergency USDC transfer (sweep all remaining USDC to owner)
 * 
 * Run: npx ts-node scripts/drain-contract-funds.ts
 */
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MARKET_ABI = [
    'function claimFees() external',
    'function accumulatedFees() view returns (uint256)',
    'function protocolFee() view returns (uint256)',
    'function owner() view returns (address)',
    'function marketCount() view returns (uint256)',
];

const USDC_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function transfer(address, uint256) returns (bool)',
    'function decimals() view returns (uint8)',
];

async function main() {
    const RPC = process.env.RPC_URL || process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org/';
    const MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MARKET_CONTRACT;
    const USDC_ADDR = process.env.USDC_CONTRACT || process.env.NEXT_PUBLIC_USDC_CONTRACT;

    if (!process.env.PRIVATE_KEY || !MARKET_ADDR || !USDC_ADDR) {
        console.error('❌ Missing PRIVATE_KEY, MARKET_ADDRESS, or USDC_CONTRACT in .env');
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const market = new ethers.Contract(MARKET_ADDR, MARKET_ABI, signer);
    const usdc = new ethers.Contract(USDC_ADDR, USDC_ABI, signer);

    console.log('==========================================================');
    console.log('  Pre-Launch Fund Drain Script');
    console.log('==========================================================\n');
    console.log(`Owner/Relayer: ${signer.address}`);
    console.log(`Market:        ${MARKET_ADDR}`);
    console.log(`USDC:          ${USDC_ADDR}\n`);

    // --- STEP 1: Check accumulated protocol fees ---
    const fees = await market.accumulatedFees();
    const feesUSDC = parseFloat(ethers.formatUnits(fees, 18));
    console.log(`Accumulated Protocol Fees: ${feesUSDC.toFixed(6)} USDC`);

    if (fees > 0n) {
        console.log('Claiming fees...');
        try {
            const tx = await market.claimFees();
            await tx.wait();
            console.log(`✅ Fees claimed: ${tx.hash}`);
        } catch (e: any) {
            console.error(`❌ Failed to claim fees: ${e.message.slice(0, 80)}`);
        }
    } else {
        console.log('No fees to claim.');
    }

    // --- STEP 2: Check total USDC in the contract ---
    console.log('\n--- USDC Balance in Contract ---');
    const contractBalance = await usdc.balanceOf(MARKET_ADDR);
    const contractBalanceFormatted = ethers.formatUnits(contractBalance, 6);
    console.log(`Contract USDC balance: ${contractBalanceFormatted} USDC`);

    if (contractBalance > 0n) {
        console.log('\n⚠️  The contract holds USDC from user deposits.');
        console.log('   User balances (userBalances mapping) are stored in the contract.');
        console.log('   The contract owner cannot directly sweep user funds');
        console.log('   (no emergencyDrain function in this contract version).');
        console.log('\n   Options:');
        console.log('   a) Users withdraw themselves before launch');
        console.log('   b) Deploy a new contract and migrate');
        console.log('   c) Fork and add an emergency drain (requires redeploy)');
        console.log('\n   For now, the protocol fee portion has been claimed above.');
    }

    // --- STEP 3: Check relayer/owner current USDC ---
    console.log('\n--- Owner/Relayer USDC Balance ---');
    const ownerBalance = await usdc.balanceOf(signer.address);
    console.log(`Owner USDC: ${ethers.formatUnits(ownerBalance, 6)} USDC`);

    const ownerBNB = await provider.getBalance(signer.address);
    console.log(`Owner BNB:  ${ethers.formatEther(ownerBNB)} BNB`);

    console.log('\n==========================================================');
    console.log('  Done. User deposits remain in contract (see above).');
    console.log('==========================================================');
}

main().catch(e => {
    console.error('Fatal:', e.message);
    process.exit(1);
});
