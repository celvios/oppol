
import { ethers, run, upgrades } from "hardhat";

async function main() {
    console.log("🚀 Starting Mainnet Deployment...");

    const [deployer] = await ethers.getSigners();
    console.log("🔑 Deployer:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 BNB Balance:", ethers.formatEther(balance));

    // 1. Configuration
    const USDC_ADDRESS = "0x8AC76a51cc950d9822D68b83xE1Ad6dF6C5001a"; // Binance-Peg USDC
    console.log("💵 USDC Address:", USDC_ADDRESS);

    // 2. Deploy SafeOracle
    console.log("\n🛡️ Deploying SafeOracle...");
    const SafeOracle = await ethers.getContractFactory("SafeOracle");
    const oracle = await SafeOracle.deploy();
    await oracle.waitForDeployment();
    const oracleAddr = await oracle.getAddress();
    console.log("✅ SafeOracle deployed to:", oracleAddr);

    // 3. Deploy PredictionMarketMultiV2 (UUPS)
    console.log("\n📈 Deploying PredictionMarketMultiV2 (UUPS)...");
    const Market = await ethers.getContractFactory("PredictionMarketMultiV2");

    const market = await upgrades.deployProxy(Market, [USDC_ADDRESS, oracleAddr], {
        initializer: "initialize",
        kind: "uups",
    });

    await market.waitForDeployment();
    const marketAddr = await market.getAddress();
    console.log("✅ PredictionMarketMultiV2 Proxy deployed to:", marketAddr);

    // 4. Verification
    console.log("\n📝 Verification Commands:");
    console.log(`npx hardhat verify --network bsc ${oracleAddr}`);
    console.log(`npx hardhat verify --network bsc ${marketAddr} (Verify Proxy Implementation via Etherscan UI)`);

    console.log("\n⚠️ IMPORTANT: Update your .env files with:");
    console.log(`NEXT_PUBLIC_MARKET_ADDRESS=${marketAddr}`);
    console.log(`MARKET_CONTRACT=${marketAddr}`);
    console.log(`USDC_CONTRACT=${USDC_ADDRESS}`);

    console.log("\n🔒 Token Gating Configuration needed!");
    console.log(`Run: npx hardhat run scripts/config-token-gating.ts --network bsc`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
