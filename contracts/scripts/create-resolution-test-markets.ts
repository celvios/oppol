import { ethers } from "hardhat";

async function main() {
    console.log("⏱️ Creating 5 Resolution Test Markets (5 min duration)...\n");

    const MARKET_ADDRESS = "0x57f3E8D7543ba4008708B80116aB7FAcc7D265e5";
    const USDC_ADDRESS = "0xA4FbcEe08b7AAA2F59D3469C0f28A32588740dc7";

    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const market = await ethers.getContractAt("PredictionMarketUMA", MARKET_ADDRESS);
    const usdc = await ethers.getContractAt("MockUSDC", USDC_ADDRESS);

    // 5 Test Markets ending in 5 minutes
    const markets = [
        { question: "TEST: Will it rain in 5 minutes?", duration: 300, liquidity: 100, subsidy: 100 },
        { question: "TEST: Price > $100 in 5 mins?", duration: 300, liquidity: 100, subsidy: 100 },
        { question: "TEST: Coin flip HEADS?", duration: 300, liquidity: 100, subsidy: 100 },
        { question: "TEST: Random Outcome A?", duration: 300, liquidity: 100, subsidy: 100 },
        { question: "TEST: Random Outcome B?", duration: 300, liquidity: 100, subsidy: 100 }
    ];

    const startCount = await market.marketCount();
    console.log(`Starting from Market ID: ${startCount}\n`);

    for (let i = 0; i < markets.length; i++) {
        const m = markets[i];
        try {
            const subsidyAmount = ethers.parseUnits(m.subsidy.toString(), 6);

            // Approve Subsidy
            const approveTx = await usdc.approve(MARKET_ADDRESS, subsidyAmount);
            await approveTx.wait();

            // Create Market
            // Params: question, duration, liquidityParam, subsidy
            const liquidityParam = ethers.parseUnits(m.liquidity.toString(), 6);

            console.log(`Creating: "${m.question}"...`);
            const tx = await market.createMarket(m.question, m.duration, liquidityParam, subsidyAmount);
            await tx.wait();

            console.log(`✅ Created Market ID ${Number(startCount) + i} (Ends in 5m)\n`);
        } catch (error: any) {
            console.error(`❌ Failed to create market: ${error.message}`);
        }
    }

    console.log("🎉 All test markets created!");
    console.log("Wait 5 minutes, then run resolution script.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
