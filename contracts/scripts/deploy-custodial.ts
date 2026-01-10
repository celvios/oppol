import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");

    // Deploy MockUSDC first (or use existing)
    const EXISTING_USDC = process.env.USDC_ADDRESS || "";
    const EXISTING_ORACLE = process.env.ORACLE_ADDRESS || "";

    let usdcAddress = EXISTING_USDC;
    let oracleAddress = EXISTING_ORACLE;

    if (!usdcAddress) {
        console.log("Deploying MockUSDC...");
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        const usdc = await MockUSDC.deploy();
        await usdc.waitForDeployment();
        usdcAddress = await usdc.getAddress();
        console.log("MockUSDC deployed to:", usdcAddress);
    } else {
        console.log("Using existing USDC:", usdcAddress);
    }

    if (!oracleAddress) {
        console.log("Deploying MockOracle...");
        const MockOracle = await ethers.getContractFactory("MockOracle");
        const oracle = await MockOracle.deploy();
        await oracle.waitForDeployment();
        oracleAddress = await oracle.getAddress();
        console.log("MockOracle deployed to:", oracleAddress);
    } else {
        console.log("Using existing Oracle:", oracleAddress);
    }

    // Deploy PredictionMarketUMA
    console.log("\nDeploying PredictionMarketUMA...");
    const PredictionMarketUMA = await ethers.getContractFactory("PredictionMarketUMA");
    const market = await PredictionMarketUMA.deploy(usdcAddress, oracleAddress);
    await market.waitForDeployment();
    const marketAddress = await market.getAddress();
    console.log("PredictionMarketUMA deployed to:", marketAddress);

    // Set the deployer as operator (server wallet)
    const SERVER_WALLET = process.env.SERVER_WALLET || deployer.address;
    console.log("\nSetting operator:", SERVER_WALLET);
    const tx = await market.setOperator(SERVER_WALLET, true);
    await tx.wait();
    console.log("Operator set successfully!");

    // Summary
    console.log("\n========== DEPLOYMENT SUMMARY ==========");
    console.log("USDC Address:", usdcAddress);
    console.log("Oracle Address:", oracleAddress);
    console.log("Market Address:", marketAddress);
    console.log("Operator (Server):", SERVER_WALLET);
    console.log("=========================================");
    console.log("\nUpdate your .env with:");
    console.log(`MARKET_ADDRESS=${marketAddress}`);
    console.log(`USDC_ADDRESS=${usdcAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
