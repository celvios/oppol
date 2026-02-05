
import { ethers } from "hardhat";

async function main() {
    const PROXY_ADDRESS = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";

    console.log("🚀 Starting Manual V3 Upgrade (Fixed Script)...");
    console.log(`Target Proxy: ${PROXY_ADDRESS}`);

    // 1. Deploy Implementation
    console.log("Deploying PredictionMarketMultiV3 implementation...");

    // Use deployContract for cleaner Ethers v6 syntax
    const v3Impl = await ethers.deployContract("PredictionMarketMultiV3");

    console.log("Waiting for deployment...");
    await v3Impl.waitForDeployment();

    const implAddress = await v3Impl.getAddress();
    console.log(`✅ Implementation Deployed at: ${implAddress}`);

    // 2. Upgrade Proxy
    console.log("Upgrading Proxy to use new implementation...");

    // Cast proxy to V3 interface
    const proxy = await ethers.getContractAt("PredictionMarketMultiV3", PROXY_ADDRESS);

    try {
        const tx = await proxy.upgradeTo(implAddress);
        console.log(`Upgrade tx sent: ${tx.hash}`);
        await tx.wait();
        console.log("✅ Proxy Upgraded");
    } catch (e: any) {
        console.error("❌ Upgrade Failed:", e.message);
        return;
    }

    // 3. Initialize V3
    console.log("Initializing V3 state...");
    try {
        const tx = await proxy.initializeV3();
        await tx.wait();
        console.log("✅ V3 Initialized");
    } catch (e: any) {
        console.log("⚠️ Initialization failed (maybe already initialized):", e.message);
    }

    // 4. Set Fees
    console.log("Setting Fees...");
    try {
        // Set Protocol Fee to 10%
        const tx1 = await proxy.setProtocolFee(1000);
        await tx1.wait();
        console.log("✅ Protocol Fee set to 10%");

        // Check verification
        const fee = await proxy.protocolFee();
        const creatorFee = await proxy.creatorFeeBps();
        console.log("\n📊 New Configuration:");
        console.log(`- Protocol Fee: ${fee} (10%)`);
        console.log(`- Creator Fee:  ${creatorFee} (2%)`);

    } catch (e: any) {
        console.log("❌ Failed to set fees:", e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
