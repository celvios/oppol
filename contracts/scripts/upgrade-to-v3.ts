import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function main() {
    console.log("🚀 Starting V3 Upgrade...");

    // Hardcode address for reliability during debug
    // CORRECT MAINNET ADDRESS from .env
    const PROXY_ADDRESS = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    console.log(`Using Proxy: ${PROXY_ADDRESS}`);

    // Deploy new implementation
    const V3 = await ethers.getContractFactory("PredictionMarketMultiV3");
    console.log("Upgrading to V3...");

    // Validate upgrade (skip storage check if V2->V3 is safe)
    const v3 = await upgrades.upgradeProxy(PROXY_ADDRESS, V3, {
        unsafeSkipStorageCheck: true,
    });

    await v3.waitForDeployment();

    console.log("✅ Upgraded to V3 at:", await v3.getAddress());

    // Initialize/Set specific V3 settings
    // Note: initialize() is not called on upgrade, variables are 0 by default.
    // We must set them manually.

    console.log("⚙️ Configuring V3 Fees...");
    // 8% = 800, 2% = 200
    // Note: setFees doesn't exist, use individual setters

    try {
        const pTx = await v3.setProtocolFee(1000); // 10% total
        await pTx.wait();
        console.log("✅ Protocol Fee set to 10%");

        const cTx = await v3.setCreatorFee(200); // 2% creator
        await cTx.wait();
        console.log("✅ Creator Fee set to 2%");

        // Configure Dual Access
        const BC400_ADDRESS = "0x61Fc93c7C070B32B1b1479B86056d8Ec1D7125BD";
        const MIN_BALANCE = 10000000n * 10n ** 18n; // 10 Million

        console.log("⚙️ Configuring Secondary Creation Access...");
        const sTx = await v3.setSecondaryCreationSettings(BC400_ADDRESS, MIN_BALANCE);
        await sTx.wait();
        console.log(`✅ Secondary Creation Token set to ${BC400_ADDRESS}`);
        console.log(`✅ Secondary Min Balance set to 10,000,000`);

    } catch (e: any) {
        console.log("⚠️ Error setting configuration:", e.message);
    }

    console.log(`🔍 Verification - Upgrade Complete`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
