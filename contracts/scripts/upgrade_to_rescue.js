const { ethers, upgrades } = require("hardhat"); // Using Hardhat Upgrades plugin if available
require("dotenv").config();

async function main() {
    const GHOST_PROXY = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    const USER_ADDR = "0x93Edd0429c6Ac4B3644A174Ade5E9d4412E43680";
    const AMOUNT_TO_RESCUE = ethers.parseUnits("1.992216439902026248", 18); // USDC on BSC is 18 dec

    console.log("🚀 Starting Rescue Operation...");
    console.log("Target Proxy:", GHOST_PROXY);
    console.log("Target User:", USER_ADDR);
    console.log("Amount:", AMOUNT_TO_RESCUE.toString());

    // 1. Deploy New Implementation
    console.log("\ndeploying RescuePredictionMarket implementation...");
    const RescueFactory = await ethers.getContractFactory("RescuePredictionMarket");
    // Hardhat Upgrades 'upgradeProxy' usually handles deployment and upgrade call.
    // But depending on if OpenZeppelin plugin is installed. 
    // If not, we do manual UUPS upgrade.
    // I will attempt manual UUPS first as it's more robust without plugin config checks.

    const implementation = await RescueFactory.deploy();
    await implementation.waitForDeployment();
    const implAddress = await implementation.getAddress();
    console.log("✅ Implementation Deployed at:", implAddress);

    // 2. Perform Upgrade
    // Determine if we use upgradeTo or upgradeToAndCall
    console.log("\nConnecting to Proxy...");
    const proxy = await ethers.getContractAt("PredictionMarketMulti", GHOST_PROXY); // Use old ABI for upgradeTo

    console.log("Upgrading to new implementation...");
    const tx = await proxy.upgradeToAndCall(implAddress, "0x"); // Standard UUPS
    await tx.wait();
    console.log("✅ Upgrade Successful!");

    // 3. Call Rescue
    console.log("\nCalling rescueFunds...");
    const rescueContract = await ethers.getContractAt("RescuePredictionMarket", GHOST_PROXY); // Use new ABI on Proxy

    const rescueTx = await rescueContract.rescueFunds(USER_ADDR, AMOUNT_TO_RESCUE);
    console.log("Rescue TX Sent:", rescueTx.hash);
    await rescueTx.wait();
    console.log("✅ FUNDS RESCUED! Balance moved to Admin.");

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
