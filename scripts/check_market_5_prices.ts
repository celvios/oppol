
import { ethers } from 'ethers';
import { MARKET_ABI } from '../src/config/abis';
import { CONFIG } from '../src/config/contracts';
import { getProvider } from '../src/config/provider';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    const marketId = 5;
    console.log(`Checking Prices for Market ${marketId}...`);

    const provider = getProvider();
    const contract = new ethers.Contract(CONFIG.MARKET_CONTRACT, MARKET_ABI, provider);

    try {
        const shares = await contract.getMarketShares(marketId);
        const prices = await contract.getAllPrices(marketId);
        const basicInfo = await contract.getMarketBasicInfo(marketId);
        const res = await pool.query('SELECT prices FROM markets WHERE market_id = $1', [marketId]);

        console.log("Liquidity Param RAW:", basicInfo.liquidityParam.toString());
        console.log("Liquidity Formatted (18):", ethers.formatUnits(basicInfo.liquidityParam, 18));
        console.log("Liquidity Formatted (6):", ethers.formatUnits(basicInfo.liquidityParam, 6));

    } catch (e) {
        console.error("Error:", e);
    }
    await pool.end();
}

main().catch(console.error);
