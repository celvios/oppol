import { ethers } from "hardhat";

async function main() {
    console.log("Deploying LMSR contracts...");

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();
    const usdcAddress = await usdc.getAddress();
    console.log("MockUSDC:", usdcAddress);

    // Deploy LMSR Market
    const Market = await ethers.getContractFactory("PredictionMarketLMSR");
    const market = await Market.deploy(usdcAddress);
    await market.waitForDeployment();
    const marketAddress = await market.getAddress();
    console.log("PredictionMarketLMSR:", marketAddress);

    // Approve and create market
    try {
        const subsidy = ethers.parseUnits("1000", 6);
        await usdc.approve(marketAddress, subsidy);

        await market.createMarket(
            "Will BTC reach $100k by end of 2026?",
            30 * 24 * 60 * 60,
            ethers.parseUnits("1000", 6),
            subsidy
        );

        const price = await market.getPrice(0);
        console.log("Market created! Initial price:", price.toString(), "basis points");
    } catch (e: any) {
        console.log("Market creation skipped:", e.message);
    }

    console.log("\nDeployment complete!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
