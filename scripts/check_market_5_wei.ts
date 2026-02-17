
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
    const creationBlock = 81746946;
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, creationBlock - 5000);

    const filter = contract.filters.SharesPurchased(marketId);

    // Chunked fetching
    const CHUNK_SIZE = 2000;
    let totalVolume = BigInt(0);

    for (let i = fromBlock; i <= currentBlock; i += CHUNK_SIZE) {
        const to = Math.min(i + CHUNK_SIZE - 1, currentBlock);
        try {
            const logs = await contract.queryFilter(filter, i, to);
            logs.forEach((log: any) => {
                const cost = BigInt(log.args[4]);
                totalVolume += cost;
            });
        } catch (e) {
            console.error(`Error chunk ${i}-${to}:`, e);
        }
    }

    console.log("MARKET_5_WEI=" + totalVolume.toString());
    require('fs').writeFileSync('market_5_wei.txt', totalVolume.toString());
}

main().catch(console.error);
