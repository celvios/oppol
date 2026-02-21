import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function main() {
    console.log("🚀 Deploying FRESH PredictionMarketMultiV3 Proxy...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    const USDC_ADDRESS = process.env.USDC_CONTRACT || process.env.NEXT_PUBLIC_USDC_CONTRACT || "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
    const ORACLE_ADDRESS = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd";

    console.log(`USDC Address: ${USDC_ADDRESS}`);
    console.log(`Oracle Address: ${ORACLE_ADDRESS}`);

    const PredictionMarketMultiV3 = await ethers.getContractFactory("PredictionMarketMultiV3");

    console.log("Deploying Proxy...");
    const marketProxy = await upgrades.deployProxy(
        PredictionMarketMultiV3,
        [USDC_ADDRESS, ORACLE_ADDRESS],
        {
            initializer: "initialize",
            kind: "uups",
        }
    );

    await marketProxy.waitForDeployment();
    const marketAddress = await marketProxy.getAddress();
    console.log(`✅ Proxy Deployed at: ${marketAddress}`);

    const implAddress = await upgrades.erc1967.getImplementationAddress(marketAddress);
    console.log(`   -> V3 Implementation: ${implAddress}`);

    // Call initializeV3
    console.log("\nInitializing V3 variables (Creator fees)...");
    const tx = await marketProxy.initializeV3();
    await tx.wait();
    console.log("✅ V3 Initialized");

    // Set Protocol Fees
    console.log("\nSetting 10% Protocol Fee...");
    const feeTx = await marketProxy.setProtocolFee(1000); // 10%
    await feeTx.wait();
    console.log("✅ Protocol Fee set");

    console.log("\n🎉 Deployment Complete!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`MARKET Contract:   ${marketAddress}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Now copy the new MARKET address into your root .env as NEXT_PUBLIC_MARKET_ADDRESS");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
