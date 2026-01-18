import { ethers, upgrades } from "hardhat";

async function main() {
    console.log("\n🚀 Deploying PredictionMarketMultiV2 as UUPS Proxy");
    console.log("=".repeat(60));

    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);

    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(balance), "BNB\n");

    // Configuration
    const USDC_ADDRESS = process.env.USDC_CONTRACT || "0xa7d8e3da8CAc0083B46584F416b98AB934a1Ed0b";
    const UMA_ORACLE = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd";

    console.log("USDC:", USDC_ADDRESS);
    console.log("UMA Oracle:", UMA_ORACLE);

    // Deploy as UUPS proxy
    console.log("\n📦 Deploying PredictionMarketMultiV2 with proxy...");
    const PredictionMarketMultiV2 = await ethers.getContractFactory("PredictionMarketMultiV2");

    const market = await upgrades.deployProxy(
        PredictionMarketMultiV2,
        [USDC_ADDRESS, UMA_ORACLE],
        {
            kind: 'uups',
            initializer: 'initialize'
        }
    );

    await market.waitForDeployment();
    const proxyAddress = await market.getAddress();

    console.log("✅ Proxy deployed to:", proxyAddress);

    // Get implementation address
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("📝 Implementation at:", implementationAddress);

    // Verify state
    const owner = await market.owner();
    const token = await market.token();
    const oracle = await market.oracle();
    const marketCount = await market.marketCount();

    console.log("\n📊 Contract State:");
    console.log("  Owner:", owner);
    console.log("  Token:", token);
    console.log("  Oracle:", oracle);
    console.log("  Market Count:", marketCount.toString());

    console.log("\n" + "=".repeat(60));
    console.log("✅ DEPLOYMENT COMPLETE");
    console.log("=".repeat(60));
    console.log("\nAdd to .env:");
    console.log(`MARKET_CONTRACT=${proxyAddress}`);
    console.log(`MULTI_MARKET_ADDRESS=${proxyAddress}`);
    console.log(`USDC_CONTRACT=${USDC_ADDRESS}`);

    console.log("\n📝 Next steps:");
    console.log("1. Update .env with new contract address");
    console.log("2. Update frontend configs");
    console.log("3. Run deploy-markets-v2.ts to create markets");
    console.log("4. Test LMSR pricing with a bet\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
