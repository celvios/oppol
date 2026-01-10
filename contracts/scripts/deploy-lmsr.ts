import { ethers } from "hardhat";

async function main() {
    console.log("Deploying LMSR contracts with UMA integration...");

    // UMA Optimistic Oracle V3 on BSC Testnet
    const UMA_ORACLE_BSC_TESTNET = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd";

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();
    const usdcAddress = await usdc.getAddress();
    console.log("MockUSDC:", usdcAddress);

    // Deploy Market with UMA Oracle
    const Market = await ethers.getContractFactory("PredictionMarketUMA");
    const market = await Market.deploy(usdcAddress, UMA_ORACLE_BSC_TESTNET);
    await market.waitForDeployment();
    const marketAddress = await market.getAddress();
    console.log("PredictionMarketUMA:", marketAddress);
    console.log("UMA Oracle:", UMA_ORACLE_BSC_TESTNET);

    // Set assertion bond to $100 (100 * 10^6 for USDC)
    await market.setAssertionBond(ethers.parseUnits("100", 6));
    console.log("Assertion bond set to $100 USDC");

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
    console.log("Update client/lib/contracts.ts with:");
    console.log(`  predictionMarketLMSR: '${marketAddress}',`);
    console.log(`  mockUSDC: '${usdcAddress}',`);
    console.log(`  umaOracle: '${UMA_ORACLE_BSC_TESTNET}',`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
