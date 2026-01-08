import { ethers } from "hardhat";

async function main() {
    try {
        const MARKET_ADDR = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
        const USDC_ADDR = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

        console.log("Testing bet on Market 1...");

        const [signer] = await ethers.getSigners();
        console.log("Signer:", signer.address);

        const market = await ethers.getContractAt("PredictionMarketLMSR", MARKET_ADDR, signer);
        const usdc = await ethers.getContractAt("MockUSDC", USDC_ADDR, signer);

        // Verify Market State
        const count = await market.marketCount();
        console.log("Total Markets:", count.toString());

        if (count <= 1) {
            console.error("Market 1 does not exist! Only have:", count.toString());
            return;
        }

        const m = await market.markets(1);
        console.log("Market 1 Question:", m.question);
        console.log("Market 1 Resolved:", m.resolved);
        console.log("Market 1 EndTime:", m.endTime.toString());
        console.log("Current Time:", Math.floor(Date.now() / 1000));

        // Check balance
        const balance = await usdc.balanceOf(signer.address);
        console.log("Balance:", ethers.formatUnits(balance, 6));

        // Approve
        console.log("Approving...");
        const approveTx = await usdc.approve(MARKET_ADDR, ethers.MaxUint256);
        await approveTx.wait();
        console.log("Approved.");

        // Buy
        console.log("Buying 10 YES shares...");
        const shares = ethers.parseUnits("1", 6); // Try just 1 share
        const cost = await market.calculateCost(1, true, shares);
        console.log("Cost:", ethers.formatUnits(cost, 6));

        const maxCost = cost + (cost * 20n) / 100n; // 20% slippage
        console.log("Max Cost:", ethers.formatUnits(maxCost, 6));

        // Try manual gas limit
        const tx = await market.buyShares(1, true, shares, maxCost, { gasLimit: 2000000 });
        console.log("Transaction sent:", tx.hash);

        await tx.wait();
        console.log("✅ Bet successful!");
    } catch (error: any) {
        console.error("❌ FAILED:");
        console.error(error);
    }
}

main();
