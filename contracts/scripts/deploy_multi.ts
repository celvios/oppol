import { ethers } from "hardhat";

async function main() {
    console.log("🚀 Deploying PredictionMarketMulti...");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    // 1. Deploy MockUSDC
    console.log("📝 Deploying MockUSDC...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();
    const usdcAddress = await usdc.getAddress();
    console.log("✅ MockUSDC deployed to:", usdcAddress);

    // 2. Deploy MockOracle (OptimisticOracleV3Interface)
    console.log("📝 Deploying MockOracle...");
    const MockOracle = await ethers.getContractFactory("MockOracle");
    const oracle = await MockOracle.deploy();
    await oracle.waitForDeployment();
    const oracleAddress = await oracle.getAddress();
    console.log("✅ MockOracle deployed to:", oracleAddress);

    // 3. Deploy PredictionMarketMulti
    console.log("📝 Deploying PredictionMarketMulti...");
    const PredictionMarketMulti = await ethers.getContractFactory("PredictionMarketMulti");
    const market = await PredictionMarketMulti.deploy(usdcAddress, oracleAddress);
    await market.waitForDeployment();
    const marketAddress = await market.getAddress();
    console.log("✅ PredictionMarketMulti deployed to:", marketAddress);

    console.log("\n🎉 Deployment Complete!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("MockUSDC:", usdcAddress);
    console.log("MockOracle:", oracleAddress);
    console.log("PredictionMarketMulti:", marketAddress);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
