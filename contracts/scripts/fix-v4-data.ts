const { ethers } = require("hardhat");

async function main() {
    const PROXY_ADDRESS = process.env.NEXT_PUBLIC_MARKET_ADDRESS || "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    console.log(`🚀 Fixing Data on V4 at ${PROXY_ADDRESS}...`);

    const [signer] = await ethers.getSigners();
    console.log(`🔑 Signer: ${signer.address}`);

    const V4ABI = [
        "function fixMarketLiquidity(uint256 marketId, uint256 newLiquidityParam) external",
        "function marketCount() view returns (uint256)",
        "function getMarketBasicInfo(uint256) view returns (string, string, string, uint256, uint256, uint256, bool, uint256)"
    ];

    const market = new ethers.Contract(PROXY_ADDRESS, V4ABI, signer);

    const count = await market.marketCount();
    console.log(`Total Markets: ${count}`);

    for (let i = 0; i < Number(count); i++) {
        console.log(`\n--- Checking Market ${i} ---`);
        try {
            const info = await market.getMarketBasicInfo(i);
            const outcomeCount = Number(info[3]);
            const currentLiquidity = BigInt(info[5]);

            // Calculate expected liquidity (outcomeCount * 100 * 1e18) for correct scaling
            // Assuming collateral token has 18 decimals standard
            const expectedLiquidity = BigInt(outcomeCount * 100) * BigInt(1e18);

            console.log(`Outcomes: ${outcomeCount}`);
            console.log(`Current Liquidity: ${currentLiquidity}`);
            console.log(`Expected Liquidity: ${expectedLiquidity}`);

            if (currentLiquidity === expectedLiquidity) {
                console.log("✅ Liquidity correct.");
            } else {
                console.log(`⚠️ Mismatch! Fixing to ${expectedLiquidity}...`);
                const tx = await market.fixMarketLiquidity(i, expectedLiquidity);
                console.log(`Tx sent: ${tx.hash}`);
                await tx.wait();
                console.log("✅ Market Fixed!");
            }
        } catch (e: any) {
            console.error(`❌ Error processing market ${i}:`, e.message);
            console.error(`Stack:`, e.stack);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
