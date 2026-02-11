const { ethers } = require("hardhat");

async function main() {
    const PROXY_ADDRESS = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    const V4ABI = [
        "function getAllPrices(uint256 marketId) view returns (uint256[])",
        "function getMarketBasicInfo(uint256) view returns (string, string, string, uint256, uint256, uint256, bool, uint256)",
        "event SharesPurchased(uint256 indexed marketId, address indexed user, uint256 outcomeIndex, uint256 shares, uint256 cost)"
    ];

    const [signer] = await ethers.getSigners();
    const market = new ethers.Contract(PROXY_ADDRESS, V4ABI, signer);

    console.log("\n=== MARKET 4 STATE ===");

    // Get prices
    const prices = await market.getAllPrices(4);
    console.log(`Prices (basis points): ${prices.map(p => p.toString()).join(', ')}`);
    console.log(`Prices (percent): ${prices.map(p => (Number(p) / 100).toFixed(2) + '%').join(', ')}`);

    // Get volume by scanning for SharesPurchased events
    const provider = signer.provider;
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 50000; // Last ~1.5 days

    console.log(`\nScanning for trades from block ${fromBlock} to ${currentBlock}...`);

    const filter = market.filters.SharesPurchased(4);
    const logs = await market.queryFilter(filter, fromBlock, currentBlock);

    let totalVolume = BigInt(0);
    console.log(`Found ${logs.length} trades`);

    for (const log of logs) {
        const cost = log.args[4]; // 5th parameter is cost
        totalVolume += BigInt(cost);
        console.log(`  Trade: ${ethers.formatUnits(cost, 18)} USDC`);
    }

    console.log(`\nTotal Volume: ${ethers.formatUnits(totalVolume, 18)} USDC`);
}

main();
