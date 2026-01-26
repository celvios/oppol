import { ethers, upgrades } from "hardhat";

async function main() {
    console.log("🔄 Upgrading PredictionMarketMulti to V2 with image/description support...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Upgrading with account:", deployer.address);

    const PROXY_ADDRESS = process.env.MULTI_MARKET_ADDRESS || process.env.NEXT_PUBLIC_MARKET_ADDRESS || "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";

    console.log(`\n📍 Proxy Address: ${PROXY_ADDRESS}`);

    console.log("\n1️⃣ Compiling V2 implementation...");
    const PredictionMarketMultiV2 = await ethers.getContractFactory("PredictionMarketMultiV2");

    console.log("\n2️⃣ Upgrading proxy to V2...");

    // Attempt to force import if manifest is missing
    console.log("Attempting to force import (recovery mode)...");
    try {
        await upgrades.forceImport(PROXY_ADDRESS, PredictionMarketMultiV2);
        console.log("✅ Force import successful");
    } catch (e: any) {
        console.log("⚠️ Force import failed/skipped:", e.message);
    }

    const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, PredictionMarketMultiV2);
    await upgraded.waitForDeployment();

    console.log("✅ Upgrade complete!");

    const newImplAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log(`\n📝 New Implementation Address: ${newImplAddress}`);

    console.log("\n3️⃣ Verifying upgrade...");
    const contract = await ethers.getContractAt("PredictionMarketMultiV2", PROXY_ADDRESS);
    const marketCount = await contract.marketCount();
    console.log(`✅ Market Count: ${marketCount}`);

    console.log("\n🎉 Upgrade Successful!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Proxy Address (unchanged): ${PROXY_ADDRESS}`);
    console.log(`New Implementation: ${newImplAddress}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n✨ You can now use createMarket with image/description!");
    console.log("   createMarket(question, image, description, outcomes, durationDays)");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
