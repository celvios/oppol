import { ethers } from "hardhat";

async function main() {
    console.log("Adding 2 short-duration test markets...\n");

    // Existing deployed contracts
    const MARKET_ADDRESS = "0x7DF49AcDB3c81853801bC1938A03d36205243b0b";
    const USDC_ADDRESS = "0x4D5988a2660F7eaffd2113E2268e90bc1f186523";

    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const market = await ethers.getContractAt("PredictionMarketUMA", MARKET_ADDRESS);
    const usdc = await ethers.getContractAt("MockUSDC", USDC_ADDRESS);

    const currentCount = await market.marketCount();
    console.log("Current market count:", currentCount.toString());

    // 30 minutes in seconds
    const THIRTY_MINUTES = 30 * 60;

    const shortMarkets = [
        {
            question: "TEST: Will this resolve to YES? (ends in 30 min)",
            duration: THIRTY_MINUTES,
            liquidity: 500,
            subsidy: 100
        },
        {
            question: "TEST: Quick assertion test market (ends in 30 min)",
            duration: THIRTY_MINUTES,
            liquidity: 500,
            subsidy: 100
        }
    ];

    for (let i = 0; i < shortMarkets.length; i++) {
        const m = shortMarkets[i];
        console.log(`\nCreating market: "${m.question}"`);

        try {
            const subsidyAmount = ethers.parseUnits(m.subsidy.toString(), 6);
            const liquidityParam = ethers.parseUnits(m.liquidity.toString(), 6);

            // Approve USDC
            console.log("  Approving USDC...");
            const approveTx = await usdc.approve(MARKET_ADDRESS, subsidyAmount);
            await approveTx.wait();

            // Create market
            console.log("  Creating market...");
            const tx = await market.createMarket(
                m.question,
                m.duration,
                liquidityParam,
                subsidyAmount
            );
            await tx.wait();

            const newId = Number(currentCount) + i;
            const price = await market.getPrice(newId);
            const endTime = new Date(Date.now() + m.duration * 1000);

            console.log(`  ✅ Market ${newId} created!`);
            console.log(`  Price: ${Number(price) / 100}% YES`);
            console.log(`  Ends at: ${endTime.toLocaleTimeString()}`);
        } catch (error: any) {
            console.log(`  ❌ Failed:`, error.message.substring(0, 100));
        }
    }

    const finalCount = await market.marketCount();
    console.log(`\n✨ Done! Total markets: ${finalCount}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
