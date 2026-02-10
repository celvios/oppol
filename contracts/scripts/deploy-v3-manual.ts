
const { ethers } = require("hardhat");

async function main() {
    const PROXY_ADDRESS = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    console.log("🚀 Starting V3 Manual Upgrade (Precision Fix)...");

    const [signer] = await ethers.getSigners();
    console.log(`Signer: ${signer.address}`);

    // 1. Deploy Implementation
    console.log("Deploying Implementation...");
    const V3Factory = await ethers.getContractFactory("PredictionMarketMultiV3");

    if (!V3Factory.bytecode || V3Factory.bytecode === "0x") {
        throw new Error("Failed to fetch bytecode for PredictionMarketMultiV3");
    }

    const implementation = await V3Factory.deploy();
    await implementation.waitForDeployment();
    const implAddress = await implementation.getAddress();
    console.log(`✅ Implementation Deployed at: ${implAddress}`);

    // 2. Upgrade Proxy
    console.log("Upgrading Proxy...");

    // Use minimal ABI to avoid artifact issues
    const UUPSABI = [
        "function upgradeTo(address newImplementation) external",
        "function owner() view returns (address)"
    ];

    // Connect to proxy with UUPS interface
    const proxy = new ethers.Contract(PROXY_ADDRESS, UUPSABI, signer);

    // Check owner
    try {
        const owner = await proxy.owner();
        console.log(`Contract Owner: ${owner}`);
        if (owner.toLowerCase() !== signer.address.toLowerCase()) {
            console.warn("⚠️ Signer is NOT owner! Upgrade will likely fail.");
        }
    } catch (e) {
        console.log("⚠️ Could not fetch owner:", e.message);
    }

    try {
        const upgradeTx = await proxy.upgradeTo(implAddress);
        console.log(`Upgrade Tx: ${upgradeTx.hash}`);
        await upgradeTx.wait();
        console.log("✅ Proxy Upgraded");
    } catch (e) {
        console.error("❌ Upgrade Failed:", e.message);
        return;
    }

    // 3. Initialize V3 & Set Fees
    console.log("Initializing V3 & Setting Fees...");

    // Connect with V3 interface for specific functions
    const proxyV3 = V3Factory.attach(PROXY_ADDRESS);

    try {
        const initTx = await proxyV3.initializeV3();
        await initTx.wait();
        console.log("✅ V3 Initialized");
    } catch (e) {
        console.log("⚠️ Initialization warning (already init?):", e.message);
    }

    try {
        // Set Total Protocol Fee to 10% (1000 bps)
        const feeTx = await proxyV3.setProtocolFee(1000);
        await feeTx.wait();
        console.log("✅ Protocol Fee set to 10%");

        // Set Creator Fee to 2% (200 bps)
        const cFeeTx = await proxyV3.setCreatorFee(200);
        await cFeeTx.wait();
        console.log("✅ Creator Fee set to 2%");

    } catch (e) {
        console.log("⚠️ Set Fee warning:", e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
