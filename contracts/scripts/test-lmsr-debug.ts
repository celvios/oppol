import { ethers } from "hardhat";

async function main() {
    console.log("\n🧪 Testing LMSR Price Updates (DEBUG MODE)");
    console.log("=".repeat(60));

    const [deployer] = await ethers.getSigners();
    const marketAddress = "0x221C4CFADE97b5d3D8C1016C3FbAe3C23eC79772";
    const usdcAddress = "0xa7d8e3da8CAc0083B46584F416b98AB934a1Ed0b";

    console.log("Tester:", deployer.address);
    const market = await ethers.getContractAt("PredictionMarketMultiV2", marketAddress);
    const usdc = await ethers.getContractAt("MockUSDC", usdcAddress);

    // Test parameters
    const marketId = 0;
    const outcomeIndex = 3;
    const shareAmount = ethers.parseUnits("100", 6); // 100 Shares

    // 1. Calculate Cost
    const cost = await market.calculateCost(marketId, outcomeIndex, shareAmount);
    const maxCost = cost * 105n / 100n; // 5% slippage
    console.log(`\nBuying ${ethers.formatUnits(shareAmount, 6)} shares`);
    console.log(`Cost: ${ethers.formatUnits(cost, 6)} USDC`);
    console.log(`Max Cost: ${ethers.formatUnits(maxCost, 6)} USDC`);

    // 2. Check Allowance
    let allowance = await usdc.allowance(deployer.address, marketAddress);
    console.log(`Initial Allowance: ${ethers.formatUnits(allowance, 6)} USDC`);

    // 3. Approve if needed (Approve MaxCost just to be safe)
    if (allowance < maxCost) {
        console.log("Approving...");
        const tx = await usdc.approve(marketAddress, ethers.MaxUint256); // Approve infinite
        await tx.wait();
        console.log("Approved Infinite USDC");
    }

    // 4. Verify Allowance
    allowance = await usdc.allowance(deployer.address, marketAddress);
    console.log(`Current Allowance: ${ethers.formatUnits(allowance, 6)} USDC`);

    if (allowance < cost) {
        throw new Error("Allowance still insufficient!");
    }

    // 4.5 DEPOSIT FUNDS!
    console.log("Depositing funds...");
    const depositTx = await market.deposit(maxCost);
    await depositTx.wait();
    console.log(`✅ Deposited ${ethers.formatUnits(maxCost, 6)} USDC`);

    // 5. Buy Shares
    console.log("Sending buy transaction...");
    try {
        const tx = await market.buyShares(marketId, outcomeIndex, shareAmount, maxCost);
        console.log("TX Sent:", tx.hash);
        await tx.wait();
        console.log("✅ Bet Placed Successfully!");

        // 6. Check Prices
        const prices = await market.getAllPrices(marketId);
        console.log("\nNew Prices:", prices.map((p: bigint) => (Number(p) / 100).toFixed(2) + "%").join(", "));

    } catch (e: any) {
        console.error("❌ Failed to buy shares:");
        if (e.data) {
            console.error("Error Data:", e.data);
            // Try decoding
            try {
                const decoded = market.interface.parseError(e.data);
                console.log("Decoded Error:", decoded?.name, decoded?.args);
            } catch (err) {
                console.log("Could not decode error");
            }
        } else {
            console.error(e.message);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
