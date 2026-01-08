import { ethers } from "hardhat";

async function main() {
    console.log("Checking Market State...\n");

    const MARKET_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
    const USDC_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

    const [signer] = await ethers.getSigners();
    console.log("Signer:", signer.address);

    const market = await ethers.getContractAt("PredictionMarketLMSR", MARKET_ADDRESS);
    const usdc = await ethers.getContractAt("MockUSDC", USDC_ADDRESS);

    // 1. Check Market Count
    const count = await market.marketCount();
    console.log(`Total Markets: ${count}`);

    if (count <= 1) {
        console.log("Market 1 does not exist yet!");
        return;
    }

    // 2. Check Market 1
    const m = await market.markets(1);
    console.log(`Market 1: ${m.question} (Resolved: ${m.resolved})`);

    // 3. Check Balance
    const balance = await usdc.balanceOf(signer.address);
    console.log(`USDC Balance: ${ethers.formatUnits(balance, 6)}`);

    // 4. Check Allowance
    const allowance = await usdc.allowance(signer.address, MARKET_ADDRESS);
    console.log(`Allowance: ${ethers.formatUnits(allowance, 6)}`);

    // 5. Try Simulate Cost
    try {
        const shares = ethers.parseUnits("100", 6);
        const cost = await market.calculateCost(1, true, shares);
        console.log(`Cost for 100 YES: ${ethers.formatUnits(cost, 6)} USDC`);

        const maxCost = cost + (cost * 5n) / 100n;
        console.log(`Max Cost (5% slip): ${ethers.formatUnits(maxCost, 6)} USDC`);

        console.log(`Raw Balance: ${balance.toString()}`);
        console.log(`Raw Cost: ${cost.toString()}`);
        console.log(`Raw MaxCost: ${maxCost.toString()}`);

        if (balance < maxCost) {
            console.log("❌ Insufficient Balance!");
        } else {
            console.log("✅ Balance OK");

            // Try to buy if balance is OK
            console.log("Attempting to buy...");
            const tx = await market.buyShares(1, true, shares, maxCost, { gasLimit: 500000 });
            await tx.wait();
            console.log("✅ Buy Successful in Script!");
        }
    } catch (e: any) {
        console.log(`❌ Calculate Cost failed: ${e.message}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
