/**
 * set-protocol-fee.ts
 * 
 * Updates the on-chain protocol fee from 5% → 10%.
 * The fee is enforced automatically by the contract in every buyShares call.
 * 
 * Run as the contract owner:
 *   npx ts-node scripts/set-protocol-fee.ts
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MARKET_ABI = [
    'function setProtocolFee(uint256 _fee) external',
    'function protocolFee() view returns (uint256)',
    'function accumulatedFees() view returns (uint256)',
    'function owner() view returns (address)',
];

async function main() {
    const rpcUrl = process.env.RPC_URL || process.env.BNB_RPC_URL;
    const privateKey = process.env.PRIVATE_KEY;
    const marketAddress = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MARKET_CONTRACT;

    if (!rpcUrl || !privateKey || !marketAddress) {
        console.error('❌ Missing RPC_URL, PRIVATE_KEY, or MARKET_CONTRACT in .env');
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);
    const market = new ethers.Contract(marketAddress, MARKET_ABI, signer);

    console.log('==============================================');
    console.log('  Protocol Fee Update: 5% → 10%');
    console.log('==============================================\n');

    // --- Read current state ---
    const owner = await market.owner();
    const currentFee = await market.protocolFee();
    const accumulated = await market.accumulatedFees();

    console.log(`Contract:          ${marketAddress}`);
    console.log(`Owner:             ${owner}`);
    console.log(`Caller:            ${signer.address}`);
    console.log(`Current Fee:       ${Number(currentFee) / 100}%  (${currentFee} bps)`);
    console.log(`Accumulated Fees:  ${ethers.formatUnits(accumulated, 6)} USDC`);
    console.log('');

    if (signer.address.toLowerCase() !== owner.toLowerCase()) {
        console.error('❌ Caller is NOT the contract owner. Cannot update fee.');
        process.exit(1);
    }

    if (Number(currentFee) === 1000) {
        console.log('✅ Protocol fee is already 10%. Nothing to do.');
        process.exit(0);
    }

    // --- Update fee ---
    console.log('Sending setProtocolFee(1000) transaction...');
    const tx = await market.setProtocolFee(1000); // 1000 bps = 10%
    console.log(`TX sent: ${tx.hash}`);
    console.log('Waiting for confirmation...');
    await tx.wait();

    // --- Verify ---
    const updatedFee = await market.protocolFee();
    console.log(`\n✅ Protocol fee updated: ${Number(updatedFee) / 100}% (${updatedFee} bps)`);
    console.log('\nEvery new buyShares call will now deduct 10% as protocol fee.');
    console.log('Use claimFees() as the owner to withdraw accumulated fees.');
}

main().catch(e => {
    console.error('Fatal error:', e.message);
    process.exit(1);
});
