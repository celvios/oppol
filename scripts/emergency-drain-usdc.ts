/**
 * emergency-drain-usdc.ts
 * 
 * Calls emergencyWithdraw on the deployed V3 contract to pull all USDC
 * out to the owner wallet.
 * 
 * Run AFTER upgrading to V3:
 *   npx ts-node scripts/emergency-drain-usdc.ts
 */
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MARKET_ABI = [
    'function emergencyWithdraw(address _token, address _to, uint256 _amount) external',
    'function owner() view returns (address)',
];

const USDC_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
];

async function main() {
    const RPC = process.env.RPC_URL || process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org/';
    const MARKET = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MARKET_CONTRACT;
    const USDC = process.env.USDC_CONTRACT || process.env.NEXT_PUBLIC_USDC_CONTRACT;

    if (!process.env.PRIVATE_KEY || !MARKET || !USDC) {
        console.error('❌ Missing PRIVATE_KEY, MARKET_CONTRACT, or USDC_CONTRACT');
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const market = new ethers.Contract(MARKET, MARKET_ABI, signer);
    const usdc = new ethers.Contract(USDC, USDC_ABI, provider);

    console.log('==========================================================');
    console.log('  Emergency USDC Drain');
    console.log('==========================================================');
    console.log(`Contract:  ${MARKET}`);
    console.log(`Owner:     ${signer.address}`);

    const owner = await market.owner();
    if (signer.address.toLowerCase() !== owner.toLowerCase()) {
        console.error('❌ Caller is not the owner. Aborting.');
        process.exit(1);
    }

    const contractBalance = await usdc.balanceOf(MARKET);
    const balFormatted = ethers.formatUnits(contractBalance, 6);
    console.log(`\nUSDC in contract: ${balFormatted} USDC`);

    if (contractBalance === 0n) {
        console.log('✅ Contract is already empty. Nothing to drain.');
        process.exit(0);
    }

    console.log(`\nDraining all ${balFormatted} USDC to ${signer.address}...`);

    const tx = await market.emergencyWithdraw(
        USDC,
        signer.address,
        ethers.MaxUint256  // drain everything
    );
    console.log(`TX sent: ${tx.hash}`);
    await tx.wait();

    const remaining = await usdc.balanceOf(MARKET);
    console.log(`\n✅ Done. Remaining in contract: ${ethers.formatUnits(remaining, 6)} USDC`);

    const ownerBalance = await usdc.balanceOf(signer.address);
    console.log(`Owner now holds: ${ethers.formatUnits(ownerBalance, 6)} USDC`);
}

main().catch(e => {
    console.error('Fatal:', e.message);
    process.exit(1);
});
