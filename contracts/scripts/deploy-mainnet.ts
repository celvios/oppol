import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🚀 Deploying OPOLL to BSC Mainnet (Chain ID 56)...\n");
    console.log("Deployer:", deployer.address);
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Balance:", ethers.formatEther(balance), "BNB\n");

    // ====================================================
    // 1. CONFIGURATION
    // ====================================================
    // BSC Mainnet Addresses
    const USDC_ADDRESS = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"; // Native BSC-USD
    const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E"; // PancakeSwap V2 Router

    console.log(`Config:`);
    console.log(`USDC: ${USDC_ADDRESS}`);
    console.log(`Router: ${PANCAKE_ROUTER}\n`);

    // ====================================================
    // 2. PRE-FLIGHT CHECK: ESTIMATE GAS
    // ====================================================
    console.log("🔍 Running Pre-Flight Gas Estimation...");
    try {
        const feeData = await ethers.provider.getFeeData();
        const gasPrice = feeData.gasPrice ?? BigInt(3000000000); // Default 3 gwei if null
        console.log(`Gas Price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);

        // 1. MockOracle Gas
        const MockOracleFactory = await ethers.getContractFactory("MockOracle");
        const oracleDeployTx = await MockOracleFactory.getDeployTransaction();
        const oracleGas = await ethers.provider.estimateGas(oracleDeployTx);

        // 2. Market Implementation Gas (Implementation only)
        const MarketFactory = await ethers.getContractFactory("PredictionMarketMultiV2");
        const marketImplTx = await MarketFactory.getDeployTransaction();
        const marketImplGas = await ethers.provider.estimateGas(marketImplTx);

        // Proxy + Admin overhead (approx conservative estimate)
        const proxyOverheadGas = BigInt(2_000_000);

        // 3. Zap Gas
        const ZapFactory = await ethers.getContractFactory("Zap");
        // Use dummy address for estimation (address format)
        const dummyAddr = "0x0000000000000000000000000000000000000001";
        const zapTx = await ZapFactory.getDeployTransaction(dummyAddr, USDC_ADDRESS, PANCAKE_ROUTER);
        const zapGas = await ethers.provider.estimateGas(zapTx);

        // TOTAL CALCULATION
        const totalGasLimit = oracleGas + marketImplGas + proxyOverheadGas + zapGas;
        const buffer = (totalGasLimit * BigInt(20)) / BigInt(100); // 20% Buffer
        const estimatedUsage = totalGasLimit + buffer;
        const estimatedCost = estimatedUsage * gasPrice;

        console.log(`\n⛽ ESTIMATED COSTS:`);
        console.log(`   MockOracle:      ${oracleGas} gas`);
        console.log(`   Market (Impl):   ${marketImplGas} gas`);
        console.log(`   Proxy Setup:     ~${proxyOverheadGas} gas`);
        console.log(`   Zap Contract:    ${zapGas} gas`);
        console.log(`   ----------------------------------`);
        console.log(`   Total Gas:       ${totalGasLimit}`);
        console.log(`   Safe Buffer:     +20%`);
        console.log(`   Total Estimate:  ${ethers.formatEther(estimatedCost)} BNB`);
        console.log(`   Your Balance:    ${ethers.formatEther(balance)} BNB`);

        if (balance < estimatedCost) {
            console.error("\n❌ INSUFFICIENT FUNDS! Deployment Cancelled.");
            console.error(`   Missing: ${ethers.formatEther(estimatedCost - balance)} BNB`);
            process.exit(1);
        }
        console.log("\n✅ Funds OK. Proceeding in 5 seconds...");
        await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (e) {
        console.warn("⚠️  Gas estimation failed (likely due to network state). Proceeding with caution...", e);
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // ====================================================
    // 3. MOCK ORACLE
    // ====================================================
    console.log("1️⃣  Deploying MockOracle...");
    const MockOracle = await ethers.getContractFactory("MockOracle");
    const oracle = await MockOracle.deploy();
    await oracle.waitForDeployment();
    const oracleAddress = await oracle.getAddress();
    console.log("✅ MockOracle:", oracleAddress);

    // ====================================================
    // 4. PREDICTION MARKET (UUPS Proxy)
    // ====================================================
    console.log("\n2️⃣  Deploying PredictionMarketMultiV2 (Proxy)...");
    const PredictionMarket = await ethers.getContractFactory("PredictionMarketMultiV2");

    // Initialize with USDC + MockOracle
    const marketProxy = await upgrades.deployProxy(PredictionMarket, [USDC_ADDRESS, oracleAddress], {
        initializer: 'initialize',
        kind: 'uups'
    });

    await marketProxy.waitForDeployment();
    const marketAddress = await marketProxy.getAddress();
    console.log("✅ PredictionMarketMultiV2 (Proxy):", marketAddress);

    const implAddress = await upgrades.erc1967.getImplementationAddress(marketAddress);
    console.log("   -> Implementation:", implAddress);

    // ====================================================
    // 5. ZAP CONTRACT
    // ====================================================
    console.log("\n3️⃣  Deploying Zap (Deposits from ANY token)...");
    const Zap = await ethers.getContractFactory("Zap");
    const zap = await Zap.deploy(marketAddress, USDC_ADDRESS, PANCAKE_ROUTER);
    await zap.waitForDeployment();
    const zapAddress = await zap.getAddress();
    console.log("✅ Zap Contract:", zapAddress);

    // ====================================================
    // 6. CONFIGURE NFT GATING (User Request)
    // ====================================================
    console.log("\n4️⃣  Configuring NFT-Gated Market Creation...");
    const PROXY_NFT = "0xB929177331De755d7aCc5665267a247e458bCdeC"; // The user's NFT
    // setCreationSettings(token, minBalance, publicCreation)
    // minBalance = 1 (Must own at least 1 NFT)
    // publicCreation = false (Restricted to NFT holders or Admin)
    const configTx = await marketProxy.setCreationSettings(PROXY_NFT, 1, false);
    await configTx.wait();
    console.log(`✅ Market Creation Gated to NFT: ${PROXY_NFT}`);

    // ====================================================
    // 7. SUMMARY
    // ====================================================
    console.log("\n🎉 MAINNET DEPLOYMENT COMPLETE!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Network: BSC Mainnet (56)");
    console.log(`MockOracle:       ${oracleAddress}`);
    console.log(`PredictionMarket: ${marketAddress}`);
    console.log(`Implementation:   ${implAddress}`);
    console.log(`Zap Contract:     ${zapAddress}`);
    console.log(`USDC (BSC):       ${USDC_ADDRESS}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n⚠️  ACTION REQUIRED: Update your Render/Vercel ENV with these addresses!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});