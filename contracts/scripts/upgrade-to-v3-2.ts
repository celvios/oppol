import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("🚀 Starting V3.2 Upgrade (Gasless Creation)...");

    const PROXY_ADDRESS = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";

    console.log(`Target Proxy: ${PROXY_ADDRESS}`);

    // Get the new contract factory
    const PredictionMarketMultiV3 = await ethers.getContractFactory("PredictionMarketMultiV3");

    // Upgrade
    console.log("Upgrading...");
    const v3 = await upgrades.upgradeProxy(PROXY_ADDRESS, PredictionMarketMultiV3);

    await v3.waitForDeployment();
    const v3Address = await v3.getAddress();
    console.log(`✅ Upgraded to V3.2 at ${v3Address}`);

    // Set Operator to the deployer (which is the server wallet in this setup)
    const [deployer] = await ethers.getSigners();
    console.log(`⚙️ Setting Operator to ${deployer.address}...`);
    try {
        const tx = await v3.setOperator(deployer.address);
        await tx.wait();
        console.log("✅ Operator set successfully");
    } catch (e: any) {
        console.log("⚠️ Error setting operator:", e.message);
    }

    console.log(`🔍 Verification - Upgrade Complete`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
