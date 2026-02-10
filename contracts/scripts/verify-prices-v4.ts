const { ethers } = require("hardhat");

async function main() {
    const PROXY_ADDRESS = process.env.NEXT_PUBLIC_MARKET_ADDRESS || "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    console.log(`🚀 Verifying Prices on V4 at ${PROXY_ADDRESS}...`);

    const V4ABI = [
        "function getAllPrices(uint256 marketId) view returns (uint256[])",
        "function getMarketBasicInfo(uint256) view returns (string, string, string, uint256, uint256, uint256, bool, uint256)",
        "function marketCount() view returns (uint256)"
    ];

    const [signer] = await ethers.getSigners();
    const market = new ethers.Contract(PROXY_ADDRESS, V4ABI, signer);

    const count = await market.marketCount();
    console.log(`Total Markets: ${count}`);

    for (let i = 0; i < Number(count); i++) {
        try {
            const prices = await market.getAllPrices(i);
            const info = await market.getMarketBasicInfo(i);
            const liquidity = info[5];

            console.log(`--- Market ${i} ---`);
            console.log(`Liquidity: ${liquidity}`);
            console.log("Prices (Raw 18 decimals):", prices.map(p => p.toString()));

            // Format to Percentage
            const percents = prices.map(p => {
                const num = Number(ethers.formatUnits(p, 18));
                return (num * 100).toFixed(2) + "%";
            });
            console.log("Prices (%):", percents);
        } catch (e) {
            console.log(`Error reading Market ${i}:`, e.message);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
