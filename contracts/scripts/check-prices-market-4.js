const { ethers } = require("hardhat");

async function main() {
    const PROXY = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    const ABI = [
        "function getAllPrices(uint256 marketId) view returns (uint256[])"
    ];

    const [signer] = await ethers.getSigners();
    const market = new ethers.Contract(PROXY, ABI, signer);

    const prices = await market.getAllPrices(4);

    console.log("\n=== MARKET 4 ON-CHAIN PRICES ===");
    console.log(`Raw (basis points): ${prices.map(p => p.toString()).join(', ')}`);
    console.log(`Formatted: ${prices.map(p => (Number(p) / 100).toFixed(2) + '%').join(', ')}`);
}

main();
