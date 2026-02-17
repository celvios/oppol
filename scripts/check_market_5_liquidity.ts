
import { ethers } from 'ethers';
import { MARKET_ABI } from '../src/config/abis';
import { CONFIG } from '../src/config/contracts';
import { getProvider } from '../src/config/provider';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    const marketId = 5;
    console.log(`Checking Liquidity for Market ${marketId}...`);

    const provider = getProvider();
    const contract = new ethers.Contract(CONFIG.MARKET_CONTRACT, MARKET_ABI, provider);

    try {
        const basicInfo = await contract.getMarketBasicInfo(marketId);
        console.log("Liquidity Param:", ethers.formatUnits(basicInfo.liquidityParam, 18));
    } catch (e) {
        console.error("Error fetching basic info:", e);
    }
}

main().catch(console.error);
