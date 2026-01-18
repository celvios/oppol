import { ethers } from "hardhat";

async function main() {
    console.log("\n🧪 Testing LMSR Price Updates");
    console.log("=".repeat(60));

    const [deployer] = await ethers.getSigners();
    const marketAddress = "0x221C4CFADE97b5d3D8C1016C3FbAe3C23eC79772";
    const usdcAddress = "0xa7d8e3da8CAc0083B46584F416b98AB934a1Ed0b";

    console.log("Tester:", deployer.address);
    console.log("Market:", marketAddress);

    const market = await ethers.getContractAt("PredictionMarketMultiV2", marketAddress);
    const usdc = await ethers.getContractAt("MockUSDC", usdcAddress);

    // Test parameters
    const marketId = 0;
    const outcomeIndex = 3; // "No - Tesla Remains #1"
    const betAmount = ethers.parseUnits("100", 6); // 100 USDC

    console.log("\n📊 BEFORE Bet:");
    console.log("-".repeat(60));

    // Get initial state
    const outcomesBefore = await market.getMarketOutcomes(marketId);
    const pricesBefore = await market.getAllPrices(marketId);
    const sharesBefore = await market.getMarketShares(marketId);

    console.log("Outcomes:", outcomesBefore.join(", "));
    console.log("Prices:", pricesBefore.map((p: bigint) => (Number(p) / 100).toFixed(2) + "%").join(", "));
    console.log("Shares:", sharesBefore.map((s: bigint) => ethers.formatUnits(s, 6)).join(", "));

    // Check USDC balance and approve
    const balance = await usdc.balanceOf(deployer.address);
    console.log("\n💰 USDC Balance:", ethers.formatUnits(balance, 6));

    if (balance < betAmount) {
        console.log("⚠️  Insufficient USDC! Minting...");
        const mintTx = await usdc.mint(deployer.address, betAmount);
        await mintTx.wait();
        console.log("✅ Minted", ethers.formatUnits(betAmount, 6), "USDC");
    }

    console.log("\n💸 Placing Bet:");
    console.log("-".repeat(60));
    console.log(`Market ${marketId}, Outcome ${outcomeIndex}: "${outcomesBefore[outcomeIndex]}"`);
    console.log(`Amount: ${ethers.formatUnits(betAmount, 6)} USDC`);

    // Approve USDC
    const approveTx = await usdc.approve(marketAddress, betAmount);
    await approveTx.wait();
    console.log("✅ USDC approved");

    // Calculate cost
    const cost = await market.calculateCost(marketId, outcomeIndex, betAmount);
    console.log(`Calculated cost: ${ethers.formatUnits(cost, 6)} USDC`);
    
    // Set max cost with 1% slippage
    const maxCost = cost * 101n / 100n;
    
    // Place bet (requires 4 params: marketId, outcomeIndex, shares, maxCost)
    const betTx = await market.buyShares(marketId, outcomeIndex, betAmount, maxCost);
    const receipt = await betTx.wait();
    console.log("✅ Bet placed! TX:", receipt.hash);

    console.log("\n📊 AFTER Bet:");
    console.log("-".repeat(60));

    // Get new state
    const pricesAfter = await market.getAllPrices(marketId);
    const sharesAfter = await market.getMarketShares(marketId);

    console.log("Prices:", pricesAfter.map((p: bigint) => (Number(p) / 100).toFixed(2) + "%").join(", "));
    console.log("Shares:", sharesAfter.map((s: bigint) => ethers.formatUnits(s, 6)).join(", "));

    console.log("\n📈 PRICE CHANGES:");
    console.log("-".repeat(60));
    for (let i = 0; i < pricesBefore.length; i++) {
        const before = Number(pricesBefore[i]) / 100;
        const after = Number(pricesAfter[i]) / 100;
        const change = after - before;
        const arrow = change > 0 ? "↑" : change < 0 ? "↓" : "→";
        const emoji = i === outcomeIndex ? "🎯" : "  ";

        console.log(`${emoji} Outcome ${i}: ${before.toFixed(2)}% → ${after.toFixed(2)}% ${arrow} ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`);
    }

    // Verify LMSR worked
    const targetPriceAfter = Number(pricesAfter[outcomeIndex]) / 100;
    const otherPriceAfter = Number(pricesAfter[0]) / 100;

    console.log("\n" + "=".repeat(60));
    if (targetPriceAfter > otherPriceAfter) {
        console.log("✅ SUCCESS! LMSR is working correctly!");
        console.log(`   Target outcome price INCREASED: ${targetPriceAfter.toFixed(2)}%`);
        console.log(`   Other outcome price DECREASED: ${otherPriceAfter.toFixed(2)}%`);
    } else {
        console.log("❌ FAILED! Prices did not update correctly");
    }
    console.log("=".repeat(60) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
