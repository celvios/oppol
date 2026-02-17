
import { ethers } from 'ethers';
import { MARKET_ABI } from '../src/config/abis';
import { CONFIG } from '../src/config/contracts';
import { getProvider } from '../src/config/provider';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    const marketId = 5;
    const provider = getProvider();
    const contract = new ethers.Contract(CONFIG.MARKET_CONTRACT, MARKET_ABI, provider);

    try {
        const prices = await contract.getAllPrices(marketId);
        console.log("Raw Prices:", prices.map((p: bigint) => p.toString()));
        console.log("Liquidity Param:", (await contract.getMarketBasicInfo(marketId)).liquidityParam.toString());
        console.log("Shares:", (await contract.getMarketShares(marketId)).map((s: bigint) => s.toString()));

    } catch (e) {
        console.error("Error:", e);
    }
}

main().catch(console.error);
