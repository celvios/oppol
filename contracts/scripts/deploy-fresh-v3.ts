import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const BC400_TOKEN = "0x61Fc93c7C070B32B1b1479B86056d8Ec1D7125BD";
const BC400_NFT = "0xB929177331De755d7aCc5665267a247e458bCdeC";
const MIN_BC400 = ethers.parseUnits("10000000", 18); // 10M BC400
const MIN_NFT = 1n;

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

    // Set BC400 as primary creation token (10M minimum)
    console.log("\nSetting BC400 as creation token (10M required)...");
    try {
        const t = await marketProxy.setCreationSettings(BC400_TOKEN, MIN_BC400, false);
        await t.wait();
        console.log("✅ BC400 creation token set");
    } catch (e: any) { console.log("⚠️  setCreationSettings:", e.message.slice(0, 80)); }

    // Set BC400 NFT as secondary creation token (1 minimum)
    console.log("\nSetting BC400 NFT as secondary creation token (1 required)...");
    try {
        const t = await marketProxy.setSecondaryCreationSettings(BC400_NFT, MIN_NFT);
        await t.wait();
        console.log("✅ BC400 NFT creation token set");
    } catch (e: any) { console.log("⚠️  setSecondaryCreationSettings:", e.message.slice(0, 80)); }

    // Set deployer as operator (so admin MetaMask = operator, can call createMarketFor)
    console.log(`\nSetting ${deployer.address} as operator...`);
    try {
        const t = await marketProxy.setOperator(deployer.address);
        await t.wait();
        console.log("✅ Operator set");
    } catch (e: any) { console.log("⚠️  setOperator:", e.message.slice(0, 80)); }

    console.log("\n🎉 Deployment Complete!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`MARKET Contract:   ${marketAddress}`);
    console.log(`Owner + Operator:  ${deployer.address}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Next steps:");
    console.log(`  1. Update Render env: NEXT_PUBLIC_MARKET_ADDRESS=${marketAddress}`);
    console.log("  2. Admin connects this MetaMask wallet to create markets (operator)");
    console.log("  3. Remove PRIVATE_KEY from Render env vars — no longer needed for market creation");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
