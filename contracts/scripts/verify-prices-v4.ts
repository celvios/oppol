const { ethers } = require("hardhat");

async function main() {
    const PROXY_ADDRESS = process.env.NEXT_PUBLIC_MARKET_ADDRESS || "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    console.log(`🚀 Verifying Volume & Prices on V4 at ${PROXY_ADDRESS}...`);

    const V4ABI = [
        "function getAllPrices(uint256 marketId) view returns (uint256[])",
        "function getMarketBasicInfo(uint256) view returns (string, string, string, uint256, uint256, uint256, bool, uint256)",
        "function marketCount() view returns (uint256)",
        "event SharesPurchased(uint256 indexed marketId, address indexed user, uint256 outcomeIndex, uint256 shares, uint256 cost)",
        "event MarketCreated(uint256 indexed marketId, string question, string image, string description, string[] outcomes, uint256 liquidity)"
    ];

    const [signer] = await ethers.getSigners();
    const marketWithEvents = new ethers.Contract(PROXY_ADDRESS, V4ABI, signer);

    const count = await marketWithEvents.marketCount();
    console.log(`Total Markets: ${count}`);

    const currentBlock = await ethers.provider.getBlockNumber();
    console.log(`Current Block: ${currentBlock}`);

    // Scan backwards max 500k blocks (approx 17 days on BSC)
    const MAX_LOOKBACK = 500000;
    const CHUNK_SIZE = 2000;
    const minBlock = Math.max(0, currentBlock - MAX_LOOKBACK);

    const i = 4; // Check Market 4 only as requested
    console.log(`\n--- Checking Market ${i} ---`);

    try {
        const prices = await marketWithEvents.getAllPrices(i);
        const info = await marketWithEvents.getMarketBasicInfo(i);
        const liquidity = info[5];

        // Calculate Volume by chunked scan
        console.log("Scanning logs...");
        let totalVolume = 0n;
        let foundCreation = false;

        // Scan backwards from current
        for (let to = currentBlock; to >= minBlock; to -= CHUNK_SIZE) {
            const from = Math.max(minBlock, to - CHUNK_SIZE + 1);

            // Get SharesPurchased
            try {
                const logs = await marketWithEvents.queryFilter(
                    marketWithEvents.filters.SharesPurchased(i),
                    from,
                    to
                );
                for (const log of logs) {
                    totalVolume += BigInt(log.args[4]);
                }
            } catch (e) {
                // ignore chunk errors
            }

            // Check if created in this chunk? (Optimization: stop if created)
            try {
                const logs = await marketWithEvents.queryFilter(
                    marketWithEvents.filters.MarketCreated(i),
                    from,
                    to
                );
                if (logs.length > 0) {
                    foundCreation = true;
                    break;
                }
            } catch (e) { }

            if (foundCreation) break;

            // Progress log every 50k blocks
            if ((currentBlock - to) % 50000 < CHUNK_SIZE) {
                console.log(`Scanned back to block ${to}...`);
            }
        }

        console.log(`Liquidity: ${liquidity}`);
        console.log(`Total Volume: ${ethers.formatUnits(totalVolume, 18)}`);

        // Format to Percentage
        const percents = prices.map(p => {
            const num = Number(p) / 100;
            return num.toFixed(2) + "%";
        });
        console.log("Prices (%):", percents);
    } catch (e) {
        console.log(`Error reading Market ${i}:`, e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
