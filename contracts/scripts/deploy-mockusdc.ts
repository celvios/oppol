import { ethers } from "hardhat";

async function main() {
    console.log("Deploying MockUSDC to BSC Testnet...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Deployer balance:", ethers.formatEther(balance), "BNB\n");

    if (balance === 0n) {
        console.error("❌ ERROR: Deployer has 0 BNB!");
        console.log("\nPlease get testnet BNB from: https://testnet.bnbchain.org/faucet-smart");
        process.exit(1);
    }

    // Deploy MockUSDC
    console.log("Deploying MockUSDC contract...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const usdcAddress = await usdc.getAddress();
    console.log("✅ MockUSDC deployed to:", usdcAddress);

    // Mint initial tokens to deployer
    console.log("\nMinting initial tokens...");
    const mintAmount = ethers.parseUnits("1000000", 6); // 1M USDC
    const mintTx = await usdc.mint(deployer.address, mintAmount);
    await mintTx.wait();
    console.log("✅ Minted 1,000,000 USDC to deployer\n");

    // Display summary
    console.log("=".repeat(60));
    console.log("DEPLOYMENT COMPLETE");
    console.log("=".repeat(60));
    console.log(`
Network:        BSC Testnet (Chain ID: 97)
MockUSDC:       ${usdcAddress}
Deployer:       ${deployer.address}

NEXT STEPS:
1. Update client/lib/contracts.ts:
   mockUSDC: '${usdcAddress}'

2. Verify contract (optional):
   npx hardhat verify --network bscTestnet ${usdcAddress}
    `);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
