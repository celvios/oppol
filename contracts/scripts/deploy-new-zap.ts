import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🚀 Deploying NEW Zap Contract (with Native BNB Support)...\n");
    console.log("Deployer:", deployer.address);

    // ====================================================
    // CONFIGURATION
    // ====================================================
    // BSC Mainnet Addresses
    const USDC_ADDRESS = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"; // Native BSC-USD
    const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E"; // PancakeSwap V2 Router

    // Existing Market Address (Don't deploy a new one!)
    const MARKET_ADDRESS = process.env.NEXT_PUBLIC_MARKET_ADDRESS || "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";

    if (MARKET_ADDRESS.includes("YourMarketAddressHere") || !MARKET_ADDRESS) {
        console.error("❌ Error: Missing MARKET_ADDRESS in .env or script config.");
        console.error("   Please ensure NEXT_PUBLIC_MARKET_ADDRESS is set in your environment.");
        process.exit(1);
    }

    console.log(`Config:`);
    console.log(`USDC:   ${USDC_ADDRESS}`);
    console.log(`Router: ${PANCAKE_ROUTER}`);
    console.log(`Market: ${MARKET_ADDRESS}\n`);

    // ====================================================
    // DEPLOY ZAP
    // ====================================================
    console.log("⚡ Deploying Zap...");
    const Zap = await ethers.getContractFactory("Zap");
    const zap = await Zap.deploy(MARKET_ADDRESS, USDC_ADDRESS, PANCAKE_ROUTER);
    await zap.waitForDeployment();
    const zapAddress = await zap.getAddress();

    console.log("\n✅ NEW Zap Contract Deployed:", zapAddress);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n⚠️  ACTION REQUIRED: Update your .env");
    console.log(`NEXT_PUBLIC_ZAP_ADDRESS=${zapAddress}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
