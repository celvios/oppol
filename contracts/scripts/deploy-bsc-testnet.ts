import { ethers } from "hardhat";

async function main() {
    console.log("Deploying to BNB Testnet...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Balance:", ethers.formatEther(balance), "BNB\n");

    // UMA Optimistic Oracle V3 on BNB Testnet
    const UMA_ORACLE_ADDRESS = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd";

    // Step 1: Deploy MockUSDC (or use existing testnet USDC)
    console.log("1. Deploying MockUSDC...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();
    const usdcAddress = await usdc.getAddress();
    console.log("   MockUSDC deployed to:", usdcAddress);

    // Mint initial USDC to deployer
    const mintAmount = ethers.parseUnits("1000000", 6); // 1M USDC
    await usdc.mint(deployer.address, mintAmount);
    console.log("   Minted 1,000,000 USDC to deployer\n");

    // Step 2: Deploy PredictionMarketUMA
    console.log("2. Deploying PredictionMarketUMA...");
    const PredictionMarketUMA = await ethers.getContractFactory("PredictionMarketUMA");
    const market = await PredictionMarketUMA.deploy(usdcAddress, UMA_ORACLE_ADDRESS);
    await market.waitForDeployment();
    const marketAddress = await market.getAddress();
    console.log("   PredictionMarketUMA deployed to:", marketAddress);

    // Step 3: Approve market contract to spend USDC
    console.log("\n3. Approving market contract...");
    const approveTx = await usdc.approve(marketAddress, ethers.MaxUint256);
    await approveTx.wait(2); // Wait for 2 confirmations
    console.log("   Approved unlimited USDC spending\n");

    // Step 4: Create initial markets
    console.log("4. Creating initial markets...\n");

    const markets = [
        {
            question: "Will BTC reach $100k by end of 2026?",
            duration: 365 * 24 * 60 * 60, // 1 year
            liquidity: ethers.parseUnits("1000", 6),
            subsidy: ethers.parseUnits("1000", 6)
        },
        {
            question: "Will ETH reach $10k by end of 2026?",
            duration: 365 * 24 * 60 * 60,
            liquidity: ethers.parseUnits("1000", 6),
            subsidy: ethers.parseUnits("1000", 6)
        },
        {
            question: "Will BNB reach $1000 by Q2 2026?",
            duration: 180 * 24 * 60 * 60, // 6 months
            liquidity: ethers.parseUnits("1000", 6),
            subsidy: ethers.parseUnits("1000", 6)
        }
    ];

    for (let i = 0; i < markets.length; i++) {
        const m = markets[i];
        try {
            console.log(`   Creating market ${i}...`);
            const tx = await market.createMarket(m.question, m.duration, m.liquidity, m.subsidy);
            await tx.wait(2);
            console.log(`   ✅ Market ${i}: ${m.question}`);
        } catch (error: any) {
            console.log(`   ❌ Market ${i} failed: ${error.message}`);
        }
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("DEPLOYMENT COMPLETE");
    console.log("=".repeat(60));
    console.log(`
Network:        BNB Testnet (Chain ID: 97)
MockUSDC:       ${usdcAddress}
Market:         ${marketAddress}
UMA Oracle:     ${UMA_ORACLE_ADDRESS}

Add these to your .env:
NEXT_PUBLIC_USDC_ADDRESS=${usdcAddress}
NEXT_PUBLIC_MARKET_ADDRESS=${marketAddress}
    `);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
