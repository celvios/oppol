const { ethers } = require("hardhat");

async function main() {
    const PROXY_ADDRESS = process.env.NEXT_PUBLIC_MARKET_ADDRESS || "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    const V4ABI = [
        "function getAllPrices(uint256 marketId) view returns (uint256[])",
        "function getMarketOutcomes(uint256 marketId) view returns (string[])",
        "function getMarketBasicInfo(uint256) view returns (string, string, string, uint256, uint256, uint256, bool, uint256)"
    ];

    const [signer] = await ethers.getSigners();
    const market = new ethers.Contract(PROXY_ADDRESS, V4ABI, signer);

    const i = 4;
    console.log(`Checking Market ${i}...`);

    try {
        const outcomes = await market.getMarketOutcomes(i);
        const prices = await market.getAllPrices(i);
        const info = await market.getMarketBasicInfo(i);

        console.log("Question:", info[0]);
        console.log("Outcomes:", outcomes);
        console.log("Prices (basis points):", prices.map(p => p.toString()));

        // Find max
        let maxIdx = 0;
        let maxPrice = BigInt(prices[0]);
        for (let j = 1; j < prices.length; j++) {
            if (BigInt(prices[j]) > maxPrice) {
                maxPrice = BigInt(prices[j]);
                maxIdx = j;
            }
        }

        console.log(`Leading Outcome: ${outcomes[maxIdx]} (${Number(maxPrice) / 100}%)`);
    } catch (e) {
        console.error(e);
    }
}

main();
