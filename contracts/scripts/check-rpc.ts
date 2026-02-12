import { ethers } from "hardhat";
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
    const RPC_URL = process.env.BNB_RPC_URL;
    console.log("Using RPC:", RPC_URL);

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const block = await provider.getBlockNumber();
        console.log("✅ Current Block:", block);

        const MARKET_ADDR = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
        const contract = new ethers.Contract(MARKET_ADDR, ["event SharesPurchased(address indexed user, uint256 indexed marketId, uint256 outcomeIndex, uint256 shares, uint256 totalCost, uint256 pricePerShare)"], provider);

        console.log("Testing Log Fetch (last 100 blocks)...");
        const logs = await contract.queryFilter(contract.filters.SharesPurchased(), block - 100, block);
        console.log("✅ Logs fetched:", logs.length);

    } catch (e: any) {
        console.error("❌ RPC Error:", e.message);
    }
}

main();
