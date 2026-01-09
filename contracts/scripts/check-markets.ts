import { ethers } from "hardhat";

async function main() {
    const marketAddress = "0x5F9C05bE2Af2adb520825950323774eFF308E353";

    const Market = await ethers.getContractFactory("PredictionMarketUMA");
    const market = Market.attach(marketAddress);

    const count = await market.marketCount();
    console.log("Market count:", count.toString());

    if (count > 0) {
        for (let i = 0; i < count; i++) {
            const m = await market.markets(i);
            console.log(`Market ${i}: ${m.question}`);
        }
    }
}

main().catch(console.error);
