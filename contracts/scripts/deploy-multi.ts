import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying PredictionMarketMulti with:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");

    // Existing addresses on BSC Testnet
    const USDC_ADDRESS = "0x87D45E316f5f1f2faffCb600c97160658B799Ee0";
    const ORACLE_ADDRESS = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd";

    console.log("\n📦 Deploying PredictionMarketMulti...");
    const PredictionMarketMulti = await ethers.getContractFactory("PredictionMarketMulti");
    const market = await PredictionMarketMulti.deploy(USDC_ADDRESS, ORACLE_ADDRESS);
    await market.waitForDeployment();

    const marketAddress = await market.getAddress();
    console.log("✅ PredictionMarketMulti deployed to:", marketAddress);

    // Set deployer as operator
    console.log("\n🔧 Setting deployer as operator...");
    const opTx = await market.setOperator(deployer.address, true);
    await opTx.wait();
    console.log("✅ Operator set");

    console.log("\n==============================================");
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("==============================================");
    console.log("PredictionMarketMulti:", marketAddress);
    console.log("USDC:", USDC_ADDRESS);
    console.log("Oracle:", ORACLE_ADDRESS);
    console.log("\nNext steps:");
    console.log("1. Update client/lib/contracts-multi.ts with the new address");
    console.log("2. Run create-multi-markets.ts to create markets");
    console.log("==============================================");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
