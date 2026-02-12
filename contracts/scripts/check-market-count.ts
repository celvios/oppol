import { ethers } from "hardhat";

async function main() {
    const RPC_URL = "https://bsc-dataseed.binance.org/";
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // The Active Contract
    const MARKET_ADDRESS = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";

    const marketAbi = [
        "function marketCount() view returns (uint256)",
        "function getMarketBasicInfo(uint256) view returns (string, string, string, uint256, uint256, uint256, bool, uint256)"
    ];

    const market = new ethers.Contract(MARKET_ADDRESS, marketAbi, provider);

    console.log("-----------------------------------------");
    console.log("🔍 Checking Market Count on 0xe3Eb...");

    try {
        const count = await market.marketCount();
        console.log(`Total Markets: ${count}`);

        if (count > 0n) {
            const latestId = Number(count) - 1;
            console.log(`Latest Market ID: ${latestId}`);

            const info = await market.getMarketBasicInfo(latestId);
            console.log(`Question: "${info[0]}"`);
            console.log(`Ends At: ${new Date(Number(info[4]) * 1000).toLocaleString()}`);
        }

    } catch (e: any) {
        console.error("Error:", e.message);
    }
}

main();
