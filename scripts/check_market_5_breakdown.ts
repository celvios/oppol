
import { ethers } from 'ethers';
import { MARKET_ABI } from '../src/config/abis';
import { CONFIG } from '../src/config/contracts';
import { getProvider } from '../src/config/provider';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    const marketId = 5;
    // console.log(`Analyzing Volume for Market ${marketId}...`);

    const provider = getProvider();
    const contract = new ethers.Contract(CONFIG.MARKET_CONTRACT, MARKET_ABI, provider);

    // 1. Get Outcome Names
    const outcomes = await contract.getMarketOutcomes(marketId);
    // console.log("Outcomes:", outcomes);

    // 2. Query all SharesPurchased events for this market
    // Filter: SharesPurchased(uint256 indexed marketId, address indexed user, uint256 outcomeIndex, uint256 shares, uint256 cost)
    const filter = contract.filters.SharesPurchased(marketId);

    // Fetch logs from a reasonably early block (deployment) to now
    // Adjust fromBlock if needed, 0 is safe but slow if many blocks, maybe use a recent-ish block or just 0 for robustness
    // BSC is fast, maybe 0 will timeout. Let's try to find creation block or just use a safe margin.
    // For now, let's try from block 0, or if it fails, we can optimize.
    // Actually, let's use `queryFilter` without a start block? No, defaults to latest.
    // Let's safe bet: last 5 Million blocks? Or just try 0.
    // DB indicated last indexed block/creation around 81746946
    const creationBlock = 81746946;
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, creationBlock - 5000);

    // Chunked fetching to avoid RPC errors
    const CHUNK_SIZE = 2000;
    const logs: any[] = [];

    // console.log(`Querying events from block ${fromBlock} to ${currentBlock} in chunks of ${CHUNK_SIZE}...`);

    for (let i = fromBlock; i <= currentBlock; i += CHUNK_SIZE) {
        const to = Math.min(i + CHUNK_SIZE - 1, currentBlock);
        try {
            const chunkLogs = await contract.queryFilter(filter, i, to);
            logs.push(...chunkLogs);
            // Optional: minimal delay to be nice to RPC
            await new Promise(r => setTimeout(r, 100));
        } catch (e) {
            console.error(`Error fetching chunk ${i}-${to}:`, e);
        }
    }

    // console.log(`Found ${logs.length} trades.`);

    const volumePerOutcome: { [key: number]: bigint } = {};
    const sharesPerOutcome: { [key: number]: bigint } = {};

    logs.forEach((log: any) => {
        const outcomeIndex = Number(log.args[2]);
        const shares = BigInt(log.args[3]);
        const cost = BigInt(log.args[4]);

        if (!volumePerOutcome[outcomeIndex]) volumePerOutcome[outcomeIndex] = 0n;
        if (!sharesPerOutcome[outcomeIndex]) sharesPerOutcome[outcomeIndex] = 0n;

        volumePerOutcome[outcomeIndex] += cost;
        sharesPerOutcome[outcomeIndex] += shares;
    });

    const totalVolume = Object.values(volumePerOutcome).reduce((a, b: any) => BigInt(a) + BigInt(b), 0n);
    console.log("Total Volume Wei:", totalVolume.toString());

    const output = {
        marketId,
        outcomes,
        volumePerOutcome: {},
        sharesPerOutcome: {},
        totalVolume: ethers.formatUnits(totalVolume, 18)
    };

    outcomes.forEach((name: string, index: number) => {
        const volume = volumePerOutcome[index] || 0n;
        const shares = sharesPerOutcome[index] || 0n;
        // @ts-ignore
        output.volumePerOutcome[name] = ethers.formatUnits(volume, 18);
        // @ts-ignore
        output.sharesPerOutcome[name] = ethers.formatUnits(shares, 18);
    });

    console.log(JSON.stringify(output, null, 2));
    require('fs').writeFileSync('market_5_final.json', JSON.stringify(output, null, 2));
}

main().catch(console.error);
