import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../../.env") });

async function main() {
    console.log("🚨 EMERGENCY DEPLOYMENT: Upgrading PredictionMarketMulti to V2Upgrade");

    const [deployer] = await ethers.getSigners();
    console.log("Rescue Admin Account:", deployer.address);
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("BNB Balance:", ethers.formatEther(balance));

    // The proxy address currently in use from .env
    const MARKET_PROXY_ADDRESS = process.env.MARKET_CONTRACT || process.env.NEXT_PUBLIC_MARKET_ADDRESS;
    if (!MARKET_PROXY_ADDRESS) {
        throw new Error("Missing MARKET_CONTRACT in .env");
    }

    console.log(`\nTargeting Proxy Contract: ${MARKET_PROXY_ADDRESS}`);

    // Get the new implementation factory
    const PredictionMarketMultiV2Rescue = await ethers.getContractFactory("PredictionMarketMultiV2Rescue");

    console.log("Upgrading proxy...");

    // Upgrade the proxy
    const upgradedMarket = await upgrades.upgradeProxy(
        MARKET_PROXY_ADDRESS,
        PredictionMarketMultiV2Rescue,
        { unsafeSkipStorageCheck: true }
    );

    await upgradedMarket.waitForDeployment();

    const newImplAddress = await upgrades.erc1967.getImplementationAddress(MARKET_PROXY_ADDRESS);
    console.log("✅ UPGRADE SUCCESSFUL!");
    console.log("Proxy Address (Unchanged):", MARKET_PROXY_ADDRESS);
    console.log("New Implementation Address:", newImplAddress);
    console.log("\nThe emergencyAdminWithdraw function is now live.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
