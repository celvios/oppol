import { ethers, upgrades } from "hardhat";

async function main() {
    console.log("🚀 Deploying Upgradeable PredictionMarketMulti...");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    // 1. Deploy MockUSDC
    console.log("📝 Deploying MockUSDC...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();
    const usdcAddress = await usdc.getAddress();
    console.log("✅ MockUSDC deployed to:", usdcAddress);

    // 2. Deploy MockOracle
    console.log("📝 Deploying MockOracle...");
    const MockOracle = await ethers.getContractFactory("MockOracle");
    const oracle = await MockOracle.deploy();
    await oracle.waitForDeployment();
    const oracleAddress = await oracle.getAddress();
    console.log("✅ MockOracle deployed to:", oracleAddress);

    // 3. Deploy Proxy
    console.log("📝 Deploying PredictionMarketMulti Proxy...");
    const PredictionMarketMulti = await ethers.getContractFactory("PredictionMarketMulti");

    // deployProxy automatically asserts that the contract is upgrade safe and initializes it
    const market = await upgrades.deployProxy(PredictionMarketMulti, [usdcAddress, oracleAddress], {
        initializer: 'initialize',
        kind: 'transparent' // or 'uups' depending on preference, 'transparent' is default and safe
    });

    await market.waitForDeployment();
    const marketAddress = await market.getAddress();

    console.log("✅ PredictionMarketMulti (Proxy) deployed to:", marketAddress);
    console.log("   Implementation Address:", await upgrades.erc1967.getImplementationAddress(marketAddress));
    console.log("   Admin Address:", await upgrades.erc1967.getAdminAddress(marketAddress));

    console.log("\n🎉 Deployment Complete!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("MockUSDC:", usdcAddress);
    console.log("MockOracle:", oracleAddress);
    console.log("PredictionMarketMulti (Proxy):", marketAddress);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
