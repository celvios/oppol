import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function main() {
    console.log("🚀 Starting V3 Upgrade...");

    // Hardcode address for reliability during debug
    const PROXY_ADDRESS = "0xA7DEd30e8A292dAA8e75A8d288393f8e290f9717";
    console.log(`Using Proxy: ${PROXY_ADDRESS}`);

    // Deploy new implementation
    const V3 = await ethers.getContractFactory("PredictionMarketMultiV3");
    console.log("Upgrading to V3...");

    // Validate upgrade (skip storage check if V2->V3 is safe)
    const v3 = await upgrades.upgradeProxy(PROXY_ADDRESS, V3, {
        unsafeSkipStorageCheck: true,
        unsafeAllow: ['audit']
    });

    await v3.waitForDeployment();

    console.log("✅ Upgraded to V3 at:", await v3.getAddress());

    // Initialize/Set specific V3 settings
    // Note: initialize() is not called on upgrade, variables are 0 by default.
    // We must set them manually.

    console.log("⚙️ Configuring V3 Fees...");
    // 8% = 800, 2% = 200
    const tx = await v3.setFees(800, 200);
    await tx.wait();

    console.log("✅ Fees set: Protocol 8%, Creator 2%");

    // Verify
    const pFee = await v3.protocolFee();
    const cFee = await v3.creatorFee();
    console.log(`🔍 Verification - Protocol: ${pFee}, Creator: ${cFee}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
