import { ethers, upgrades } from "hardhat";

async function main() {
    console.log("🔄 Upgrading PredictionMarketMulti to V2...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Upgrading with account:", deployer.address);

    // The proxy address from your .env
    const PROXY_ADDRESS = process.env.MULTI_MARKET_ADDRESS || "0x95BEec73d2F473bB9Df7DC1b65637fB4CFc047Ae";

    console.log(`\n📍 Proxy Address: ${PROXY_ADDRESS}`);

    // Get the V2 contract factory
    console.log("\n1️⃣ Compiling V2 implementation...");
    const PredictionMarketMultiV2 = await ethers.getContractFactory("PredictionMarketMultiV2");

    console.log("\n2️⃣ Upgrading proxy to V2...");
    const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, PredictionMarketMultiV2);
    await upgraded.waitForDeployment();

    console.log("✅ Upgrade complete!");

    // Get new implementation address
    const newImplAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log(`\n📝 New Implementation Address: ${newImplAddress}`);

    // Verify the upgrade worked
    console.log("\n3️⃣ Verifying upgrade...");
    const contract = await ethers.getContractAt("PredictionMarketMultiV2", PROXY_ADDRESS);
    const marketCount = await contract.marketCount();
    console.log(`✅ Market Count: ${marketCount}`);

    console.log("\n🎉 Upgrade Successful!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Proxy Address (unchanged): ${PROXY_ADDRESS}`);
    console.log(`New Implementation: ${newImplAddress}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n✨ You can now use the simplified createMarket function!");
    console.log("   createMarket(question, outcomes, durationDays)");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
