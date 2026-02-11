const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const PROXY_ADDRESS = process.env.NEXT_PUBLIC_MARKET_ADDRESS || "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    const V4ABI = [
        "function getAllPrices(uint256 marketId) view returns (uint256[])",
        "function getMarketOutcomes(uint256 marketId) view returns (string[])",
        "function getMarketBasicInfo(uint256) view returns (string, string, string, uint256, uint256, uint256, bool, uint256)"
    ];

    const [signer] = await ethers.getSigners();
    const market = new ethers.Contract(PROXY_ADDRESS, V4ABI, signer);

    const i = 2; // Check Market 2
    console.log(`Checking Market ${i}...`);

    try {
        const outcomes = await market.getMarketOutcomes(i);
        const prices = await market.getAllPrices(i);
        const info = await market.getMarketBasicInfo(i);

        const output = [
            `Market ID: ${i}`,
            `Question: ${info[0]}`,
            `Outcomes: ${JSON.stringify(outcomes)}`,
            `Liquidity Param (Wei/Raw): ${info[5].toString()}`,
            `Prices (bp): ${prices.map(p => p.toString()).join(", ")}`,
            `Outcome Count: ${info[6]}` // actually index 6 is 'bool resolved'?, wait.
            // basicInfo returns: (question, image, description, outcomeCount, endTime, liquidityParam, resolved, winningOutcome)
            // wait, check ABI mapping carefully.
            // getMarketBasicInfo returns (string, string, string, uint256, uint256, uint256, bool, uint256)
            // 0: question, 1: image, 2: description, 3: outcomeCount, 4: endTime, 5: liquidityParam, 6: resolved, 7: winningOutcome
        ].join("\n");

        console.log(output);
        fs.writeFileSync("market-2-info.txt", output);

    } catch (e) {
        console.error(e);
    }
}

main();
