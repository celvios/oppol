const { ethers } = require("hardhat");

async function main() {
    const PROXY_ADDRESS = process.env.NEXT_PUBLIC_MARKET_ADDRESS || "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    const V4ABI = [
        "function getAllPrices(uint256 marketId) view returns (uint256[])",
        "function getMarketOutcomes(uint256 marketId) view returns (string[])",
        "function getMarketBasicInfo(uint256) view returns (string, string, string, uint256, uint256, uint256, bool, uint256)",
        "function marketCount() view returns (uint256)"
    ];

    const [signer] = await ethers.getSigners();
    const market = new ethers.Contract(PROXY_ADDRESS, V4ABI, signer);

    const count = await market.marketCount();
    console.log(`Total Markets: ${count}\n`);

    for (let i = 0; i < Math.min(5, Number(count)); i++) {
        const info = await market.getMarketBasicInfo(i);
        const outcomeCount = Number(info[3]);
        const liquidityRaw = info[5].toString();
        const liquidityFormatted = ethers.formatUnits(info[5], 18);

        const expected1e18 = BigInt(outcomeCount * 100) * BigInt(1e18);
        const expected1e6 = BigInt(outcomeCount * 100) * BigInt(1e6);

        const isCorrect = info[5] === expected1e18;
        const status = isCorrect ? "✅ CORRECT (1e18)" : "❌ WRONG (still 1e6)";

        console.log(`Market ${i}: ${info[0].substring(0, 50)}...`);
        console.log(`  Outcomes: ${outcomeCount}`);
        console.log(`  Liquidity (raw): ${liquidityRaw}`);
        console.log(`  Liquidity (formatted): ${liquidityFormatted}`);
        console.log(`  Expected (1e18): ${expected1e18.toString()}`);
        console.log(`  Status: ${status}\n`);
    }
}

main();
