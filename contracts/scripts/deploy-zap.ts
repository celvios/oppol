import { ethers } from "hardhat";

async function main() {
    console.log("🚀 Deploying OPOLL zap Ecosystem...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    // 1. Deploy MockUSDC
    console.log("\n1️⃣ Deploying MockUSDC...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();
    const usdcAddress = await usdc.getAddress();
    console.log("✅ MockUSDC:", usdcAddress);

    // 2. Deploy MockOracle
    console.log("\n2️⃣ Deploying MockOracle...");
    const MockOracle = await ethers.getContractFactory("MockOracle");
    const oracle = await MockOracle.deploy();
    await oracle.waitForDeployment();
    const oracleAddress = await oracle.getAddress();
    console.log("✅ MockOracle:", oracleAddress);

    // 3. Deploy PredictionMarketUMA
    console.log("\n3️⃣ Deploying PredictionMarketUMA...");
    const PredictionMarket = await ethers.getContractFactory("PredictionMarketUMA");
    const market = await PredictionMarket.deploy(usdcAddress, oracleAddress);
    await market.waitForDeployment();
    const marketAddress = await market.getAddress();
    console.log("✅ PredictionMarketUMA:", marketAddress);

    // 4. Deploy Zap
    console.log("\n4️⃣ Deploying Zap...");
    // BSC Testnet PancakeSwap Router
    const ROUTER_ADDRESS = "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3";

    const Zap = await ethers.getContractFactory("Zap");
    const zap = await Zap.deploy(marketAddress, usdcAddress, ROUTER_ADDRESS);
    await zap.waitForDeployment();
    const zapAddress = await zap.getAddress();
    console.log("✅ Zap Contract:", zapAddress);

    console.log("\n🎉 Deployment Complete!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`NEXT_PUBLIC_MARKET_ADDRESS=${marketAddress}`);
    console.log(`NEXT_PUBLIC_USDC_ADDRESS=${usdcAddress}`);
    console.log(`NEXT_PUBLIC_ZAP_ADDRESS=${zapAddress}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
