import { ethers } from "hardhat";

async function main() {
    console.log("🚀 Deploying OPOLL Contracts to BNB Chain...\n");

    // Check for existing USDC (Preserve User Funds)
    let usdcAddress = process.env.USDC_CONTRACT;

    if (!usdcAddress) {
        console.log("📝 Deploying MockUSDC...");
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        const usdc = await MockUSDC.deploy();
        await usdc.waitForDeployment();
        usdcAddress = await usdc.getAddress();
        console.log("✅ MockUSDC deployed to:", usdcAddress);
    } else {
        console.log("ℹ️  Using existing USDC Contract:", usdcAddress);
    }

    // Deploy PredictionMarket
    console.log("\n📝 Deploying PredictionMarket...");
    const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
    const market = await PredictionMarket.deploy(usdcAddress);
    await market.waitForDeployment();
    const marketAddress = await market.getAddress();
    console.log("✅ PredictionMarket deployed to:", marketAddress);

    // Create a demo market
    console.log("\n📝 Creating demo market...");
    const tx = await market.createMarket(
        "Will BTC reach $100k by end of 2026?",
        30 * 24 * 60 * 60 // 30 days
    );
    await tx.wait();
    console.log("✅ Demo market created!");

    console.log("\n🎉 Deployment Complete!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("MockUSDC:", usdcAddress);
    console.log("PredictionMarket:", marketAddress);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n💡 Next Steps:");
    console.log("1. Update .env with PRIVATE_KEY for BSC Testnet");
    console.log("2. Get testnet BNB from https://testnet.bnbchain.org/faucet-smart");
    console.log("3. Deploy to testnet: npx hardhat run scripts/deploy.ts --network bscTestnet");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
