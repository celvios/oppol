
import { query } from './src/config/database';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org';
const USDC_ADDR = process.env.NEXT_PUBLIC_USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';

async function main() {
    console.log("--- Analyzing Sweep Cost ---");

    // 1. Get all wallets
    const allWallets = await query(`
        SELECT public_address FROM wallets
    `);

    console.log(`Scanning ${allWallets.rows.length} wallets...`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const usdcAbi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
    const usdc = new ethers.Contract(USDC_ADDR, usdcAbi, provider);

    let sweepableCount = 0;

    // Check in parallel chunks
    const CHUNK_SIZE = 20;
    for (let i = 0; i < allWallets.rows.length; i += CHUNK_SIZE) {
        const chunk = allWallets.rows.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (row) => {
            try {
                const bal = await usdc.balanceOf(row.public_address);
                if (bal > BigInt(100000)) { // > 0.1 USDC (assuming 6 decimals)
                    sweepableCount++;
                    // console.log(`Found funds in ${row.public_address}`);
                }
            } catch (e) {
                // ignore errors
            }
        }));
        process.stdout.write('.');
    }

    console.log("\n--- Analysis Complete ---");
    console.log(`Wallets to Sweep: ${sweepableCount}`);

    // Cost Estimate
    const gasPerSweep = 0.0006; // BNB
    const totalCostBNB = sweepableCount * gasPerSweep;
    const priceBNB = 600; // Approx
    const totalCostUSD = totalCostBNB * priceBNB;

    console.log(`Estimated Admin Gas Cost: ${totalCostBNB.toFixed(4)} BNB (~$${totalCostUSD.toFixed(2)})`);
}

main().catch(console.error);
