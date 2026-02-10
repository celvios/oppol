const { ethers, upgrades } = require("hardhat");

async function main() {
    const PROXY_ADDRESS = process.env.NEXT_PUBLIC_MARKET_ADDRESS || "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    console.log(`🚀 Upgrading to V4 using Plugin at ${PROXY_ADDRESS}...`);

    // Verify Signer
    const [signer] = await ethers.getSigners();
    console.log(`🔑 Signer: ${signer.address}`);

    // Factories
    const V3Factory = await ethers.getContractFactory("PredictionMarketMultiV3");
    const V4Factory = await ethers.getContractFactory("PredictionMarketMultiV4");

    // Force Import existing proxy as V3 to ensure manifest is correct
    console.log("Importing existing proxy...");
    try {
        await upgrades.forceImport(PROXY_ADDRESS, V3Factory, { kind: 'uups' });
        console.log("✅ Proxy imported successfully");
    } catch (e: any) {
        console.log("⚠️ Import warning (maybe already imported?):", e.message);
    }

    // Checking Compatibility (Dry Run)
    console.log("Checking upgrade validity...");
    // validateUpgrade is implicit in upgradeProxy but good to know

    // Upgrade
    console.log("Upgrading Proxy...");
    const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, V4Factory, {
        kind: 'uups',
        unsafeAllow: ['constructor'] // Sometimes needed if base has constructor
    });

    await upgraded.waitForDeployment();
    console.log("✅ Proxy Upgraded to V4 via Plugin");
    console.log("Address:", await upgraded.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
