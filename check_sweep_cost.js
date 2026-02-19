
const { Client } = require('pg');
const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org';
const USDC_ADDR = process.env.NEXT_PUBLIC_USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
    console.log("--- Analyzing Sweep Cost ---");

    if (!DATABASE_URL) {
        console.error("Missing DATABASE_URL in .env");
        process.exit(1);
    }

    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 1. Get all wallets
        const res = await client.query('SELECT public_address FROM wallets');
        const rows = res.rows;

        console.log(`Scanning ${rows.length} wallets...`);

        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const usdcAbi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
        const usdc = new ethers.Contract(USDC_ADDR, usdcAbi, provider);

        let sweepableCount = 0;
        let totalSweepableUSDC = 0;

        // Process in chunks
        const CHUNK_SIZE = 20;
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
            const chunk = rows.slice(i, i + CHUNK_SIZE);
            const promises = chunk.map(async (row) => {
                try {
                    const addr = row.public_address;
                    const bal = await usdc.balanceOf(addr);
                    // > 0.1 USDC (100000 wei for 6 decimals)
                    if (bal > 100000n) {
                        sweepableCount++;
                        const balFmt = ethers.formatUnits(bal, 6);
                        totalSweepableUSDC += parseFloat(balFmt);
                        // console.log(`Found ${balFmt} USDC in ${addr}`);
                    }
                } catch (e) {
                    // console.error(e);
                }
            });
            await Promise.all(promises);
            process.stdout.write('.');
        }

        console.log("\n--- Analysis Complete ---");
        console.log(`Wallets to Sweep: ${sweepableCount}`);
        console.log(`Total USDC to Recover: $${totalSweepableUSDC.toFixed(2)}`);

        // Cost Estimate
        // 0.0006 BNB per sweep (High estimate for safety)
        const gasPerSweep = 0.0006;
        const totalCostBNB = sweepableCount * gasPerSweep;
        const priceBNB = 600;
        const totalCostUSD = totalCostBNB * priceBNB;

        console.log(`Estimated Admin Gas Cost: ${totalCostBNB.toFixed(4)} BNB (~$${totalCostUSD.toFixed(2)})`);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

main();
