
import { ethers } from "hardhat";

async function main() {
    console.log("🚀 Deploying PredictionMarketMulti (Fixing Interface Mismatch)...\n");

    // 1. Get USDC Address
    let usdcAddress = process.env.USDC_CONTRACT;
    if (!usdcAddress) {
        console.log("⚠️ USDC_CONTRACT not set in env. Deploying MockUSDC...");
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        const usdc = await MockUSDC.deploy();
        await usdc.waitForDeployment();
        usdcAddress = await usdc.getAddress();
        console.log("✅ MockUSDC deployed to:", usdcAddress);
    } else {
        console.log("ℹ️  Using existing USDC Contract:", usdcAddress);
    }

    // 2. Deploy PredictionMarketMulti (Standalone/Non-Proxy for simplicity)
    // We treat it as a direct contract for now to avoid Proxy complexity if plugin issues exist.
    console.log("\n📝 Deploying PredictionMarketMulti...");
    const PredictionMarketMulti = await ethers.getContractFactory("PredictionMarketMulti");
    const market = await PredictionMarketMulti.deploy();
    await market.waitForDeployment();
    const marketAddress = await market.getAddress();
    console.log("✅ PredictionMarketMulti deployed to:", marketAddress);

    // 3. Initialize (Crucial for Upgradeable Contracts used directly)
    console.log("\n🔧 Initializing Contract...");
    // Mock Oracle Address (Random valid address for testnet, or 0x0 if allowed)
    // We use a random address because UMA interfaces might require a valid address for calls (though we won't use them).
    // Using a known burner/null address might be safer: 0x000000000000000000000000000000000000dEaD
    const MOCK_ORACLE = "0x0000000000000000000000000000000000000000";

    // We need to call initialize(token, oracle)
    try {
        const txInit = await market.initialize(usdcAddress, MOCK_ORACLE);
        await txInit.wait();
        console.log("✅ Contract Initialized!");
    } catch (e) {
        console.log("⚠️ Initialization failed (maybe already initialized?):", e);
    }

    // 4. Create Demo Market
    console.log("\n📝 Creating Demo Market (Multi-Outcome)...");

    // Approve Liquidity First! (The step we missed before)
    // We need to approve 'market' to spend 'usdc' from Deployer
    const [deployer] = await ethers.getSigners();
    const usdc = await ethers.getContractAt("IERC20", usdcAddress);

    // Check balance
    const balance = await usdc.balanceOf(deployer.address);
    console.log(`ℹ️  Deployer USDC Balance: ${ethers.formatUnits(balance, 18)}`);

    const liquidityAmount = ethers.parseUnits("100", 18); // 100 USDC liquidity

    if (balance < liquidityAmount) {
        console.log("⚠️ Not enough USDC for liquidity. Creating market with 0 liquidity (might cause issues).");
        // We will try anyway, or maybe mint if MockUSDC?
    } else {
        console.log("🔓 Approving USDC for Liquidity...");
        const txApprove = await usdc.approve(marketAddress, liquidityAmount);
        await txApprove.wait();
        console.log("✅ Approved.");
    }

    // Create Market: question, outcomes, duration, liquidityParam, subsidy
    try {
        const txCreate = await market.createMarket(
            "Will BTC hit $100k in 2026?",
            ["Yes", "No"],
            30 * 24 * 60 * 60, // 30 Days
            liquidityAmount, // Liquidity Param (b)
            0 // Subsidy
        );
        await txCreate.wait();
        console.log("✅ Demo Market Created!");
    } catch (e) {
        console.error("❌ Failed to create demo market:", e);
    }

    console.log("\n🎉 Deployment Complete!");
    console.log("MARKET_CONTRACT:", marketAddress);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
