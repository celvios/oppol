import { ethers, upgrades } from "hardhat";

async function main() {
    console.log("🚀 Deploying Fresh V2 Contract with Proxy...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    // Get existing USDC address from env
    const USDC_ADDR = process.env.USDC_CONTRACT || "0x16E4A3d9697D47c61De3bDD1DdDa4148aA09D634";
    console.log(`\n📍 Using existing USDC: ${USDC_ADDR}`);

    // For now, use a mock oracle address (can be updated later)
    const MOCK_ORACLE = "0x0000000000000000000000000000000000000001";
    console.log(`📍 Using mock oracle: ${MOCK_ORACLE}`);

    // Deploy V2 with proxy
    console.log("\n1️⃣ Deploying PredictionMarketMultiV2 (with UUPS Proxy)...");
    const PredictionMarketMultiV2 = await ethers.getContractFactory("PredictionMarketMultiV2");

    const proxy = await upgrades.deployProxy(
        PredictionMarketMultiV2,
        [USDC_ADDR, MOCK_ORACLE],
        {
            initializer: 'initialize',
            kind: 'uups'
        }
    );

    await proxy.waitForDeployment();
    const proxyAddress = await proxy.getAddress();

    console.log("✅ Proxy deployed at:", proxyAddress);

    // Get implementation address
    const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("   → Implementation:", implAddress);

    // Set deployer as operator
    console.log("\n2️⃣ Setting deployer as operator...");
    const tx = await proxy.setOperator(deployer.address, true);
    await tx.wait();
    console.log("✅ Operator set");

    // Verify deployment
    console.log("\n3️⃣ Verifying deployment...");
    const marketCount = await proxy.marketCount();
    console.log(`✅ Market Count: ${marketCount}`);

    console.log("\n🎉 Deployment Complete!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`MULTI_MARKET_ADDRESS=${proxyAddress}`);
    console.log(`USDC_CONTRACT=${USDC_ADDR}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n✨ Update your .env with the new MULTI_MARKET_ADDRESS!");
    console.log("   Then run: npx ts-node scripts/deploy_12_markets.ts");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
