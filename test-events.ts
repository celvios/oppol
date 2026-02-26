import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
dotenv.config();

async function scanAllLogs() {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || process.env.BNB_RPC_URL);
        const marketAddress = process.env.MARKET_ADDRESS || process.env.NEXT_PUBLIC_MARKET_ADDRESS;
        console.log("Contract:", marketAddress);

        const currentBlock = await provider.getBlockNumber();
        const fromBlock = currentBlock - 50000;

        console.log(`Scanning ALL logs from ${fromBlock} to ${currentBlock}`);

        const logs = await provider.getLogs({
            address: marketAddress,
            fromBlock,
            toBlock: currentBlock
        });

        console.log(`Found ${logs.length} RAW logs.`);

        // Count unqiue topic 0s
        const topics = new Set<string>();
        logs.forEach(l => topics.add(l.topics[0]));

        console.log("UNIQUE TOPIC HASHES:");
        topics.forEach(t => console.log(t));

        // Get the signature hash for what we expect
        console.log("\nEXPECTED SharesPurchased Hash:");
        console.log("V1 (totalCost):", ethers.id("SharesPurchased(uint256,address,uint256,uint256,uint256)"));
        console.log("V2 (marketId, user, outcomeIndex, shares, cost):", ethers.id("SharesPurchased(uint256,address,uint256,uint256,uint256)"));

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
scanAllLogs();
