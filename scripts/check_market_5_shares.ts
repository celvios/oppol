
import { ethers } from 'ethers';
import { MARKET_ABI } from '../src/config/abis';
import { CONFIG } from '../src/config/contracts';
import { getProvider } from '../src/config/provider';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    const marketId = 5;
    console.log(`Checking Shares for Market ${marketId}...`);

    const provider = getProvider();
    const contract = new ethers.Contract(CONFIG.MARKET_CONTRACT, MARKET_ABI, provider);

    const outcomes = await contract.getMarketOutcomes(marketId);
    const shares = await contract.getMarketShares(marketId);

    console.log("\n--- Market 5 Shares Breakdown ---");
    outcomes.forEach((name: string, index: number) => {
        const s = shares[index];
        console.log(`Outcome ${index} [${name}]: ${ethers.formatUnits(s, 18)} Shares`);
    });
}

main().catch(console.error);
