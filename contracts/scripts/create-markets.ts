import { ethers } from "hardhat";

async function main() {
    const MARKET_ADDRESS = "0xbBE2811Ab064bd76667D49346a025530310AD03E";

    const [deployer] = await ethers.getSigners();
    console.log("Creating markets with:", deployer.address);

    const market = await ethers.getContractAt("PredictionMarketUMA", MARKET_ADDRESS);

    const markets = [
        { question: "Will Bitcoin reach $150,000 by April 2026?", durationDays: 90, liquidity: 1000, subsidy: 0 },
        { question: "Will Apple release AR glasses in 2026?", durationDays: 365, liquidity: 500, subsidy: 0 },
        { question: "Will Ethereum flip Bitcoin by market cap before 2027?", durationDays: 365, liquidity: 500, subsidy: 0 },
    ];

    for (const m of markets) {
        const duration = m.durationDays * 24 * 60 * 60; // Convert days to seconds
        const liquidityUnits = ethers.parseUnits(m.liquidity.toString(), 6);
        const subsidyUnits = ethers.parseUnits(m.subsidy.toString(), 6);

        console.log(`\nCreating: "${m.question.slice(0, 40)}..."`);
        console.log(`  Duration: ${m.durationDays} days, Liquidity: ${m.liquidity}, Subsidy: ${m.subsidy}`);

        const tx = await market.createMarket(m.question, duration, liquidityUnits, subsidyUnits);
        await tx.wait();
        console.log(`  ✅ Created (tx: ${tx.hash.slice(0, 20)}...)`);
    }

    const count = await market.marketCount();
    console.log(`\n=== Total Markets: ${count} ===`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
