import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
    console.log("Deploying to BNB Testnet...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    // UMA Optimistic Oracle V3 on BNB Testnet
    const UMA_ORACLE_ADDRESS = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd";

    // Step 1: Deploy MockUSDC
    console.log("1. Deploying MockUSDC...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();
    const usdcAddress = await usdc.getAddress();
    console.log("   MockUSDC:", usdcAddress);

    // Mint initial USDC to deployer
    const mintAmount = ethers.parseUnits("10000000", 6); // 10M USDC
    await usdc.mint(deployer.address, mintAmount);
    console.log("   Minted 10,000,000 USDC to deployer");

    // Step 2: Deploy PredictionMarketUMA
    console.log("2. Deploying PredictionMarketUMA...");
    const PredictionMarketUMA = await ethers.getContractFactory("PredictionMarketUMA");
    const market = await PredictionMarketUMA.deploy(usdcAddress, UMA_ORACLE_ADDRESS);
    await market.waitForDeployment();
    const marketAddress = await market.getAddress();
    console.log("   Market:", marketAddress);

    // Step 3: Approve market contract
    console.log("3. Approving market contract...");
    await usdc.approve(marketAddress, ethers.MaxUint256);
    console.log("   Approved");

    // Step 4: Create initial markets
    console.log("4. Creating markets...");
    const markets = [
        { question: "Will BTC reach $100k by end of 2026?", duration: 365 * 24 * 60 * 60 },
        { question: "Will ETH reach $10k by end of 2026?", duration: 365 * 24 * 60 * 60 },
        { question: "Will BNB reach $1000 by Q2 2026?", duration: 180 * 24 * 60 * 60 }
    ];

    for (let i = 0; i < markets.length; i++) {
        const m = markets[i];
        const liquidity = ethers.parseUnits("1000", 6);
        await market.createMarket(m.question, m.duration, liquidity, liquidity);
        console.log(`   Market ${i} created`);
    }

    // Save addresses to JSON file
    const addresses = {
        mockUSDC: usdcAddress,
        predictionMarket: marketAddress,
        umaOracle: UMA_ORACLE_ADDRESS,
        network: "bscTestnet",
        chainId: 97,
        deployedAt: new Date().toISOString()
    };

    fs.writeFileSync("deployed-addresses.json", JSON.stringify(addresses, null, 2));
    console.log("\n✅ Addresses saved to deployed-addresses.json");
    console.log(JSON.stringify(addresses, null, 2));
}

main().catch(console.error);
