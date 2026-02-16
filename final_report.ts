import { ethers } from 'ethers';
import { query } from './src/config/database';
import { CONFIG } from './src/config/contracts';

async function run() {
    try {
        // 1. Total Volume from DB
        const volRes = await query("SELECT SUM(CAST(NULLIF(CAST(volume AS TEXT), '') AS NUMERIC)) as total_volume FROM markets");
        const totalVolume = volRes.rows[0].total_volume || 0;

        // 2. Individual Market Volumes
        const marketsRes = await query("SELECT market_id, question, volume FROM markets WHERE CAST(NULLIF(CAST(volume AS TEXT), '') AS NUMERIC) > 0 ORDER BY CAST(volume AS NUMERIC) DESC");

        // 3. Contract Liquidity
        const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
        const usdc = new ethers.Contract(CONFIG.USDC_CONTRACT, ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"], provider);
        const [balance, decimals] = await Promise.all([
            usdc.balanceOf(CONFIG.MARKET_CONTRACT),
            usdc.decimals()
        ]);
        const liquidity = ethers.formatUnits(balance, decimals);

        console.log("--- RESULTS ---");
        console.log(`Total Volume: $${totalVolume}`);
        console.log(`Total Liquidity (Contract Balance): $${liquidity}`);
        console.log("\nTop Markets:");
        marketsRes.rows.forEach((m: any) => {
            console.log(`- Market ${m.market_id}: $${m.volume} (${m.question.substring(0, 50)}...)`);
        });

    } catch (e: any) {
        console.error("Error:", e.message);
    } finally {
        process.exit(0);
    }
}
run();
