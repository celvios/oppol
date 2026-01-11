import { ethers } from "hardhat";

async function main() {
    const MARKET_ADDRESS = "0x0d0279825957d13c74E6C187Cc37D502E0c3D168";

    const [deployer] = await ethers.getSigners();
    console.log("Creating markets with:", deployer.address);

    const market = await ethers.getContractAt("PredictionMarketV2", MARKET_ADDRESS);

    const markets = [
        { question: "Will Bitcoin reach $150,000 by April 2026?", durationDays: 90 },
        { question: "Will Apple release AR glasses in 2026?", durationDays: 365 },
        { question: "Will Ethereum flip Bitcoin by market cap before 2027?", durationDays: 365 },
        { question: "Will AI replace 50% of software jobs by 2030?", durationDays: 180 },
        { question: "Will SpaceX land humans on Mars by 2028?", durationDays: 180 },
    ];

    for (const m of markets) {
        const duration = m.durationDays * 24 * 60 * 60;

        console.log(`\nCreating: "${m.question}"`);
        console.log(`  Duration: ${m.durationDays} days`);

        const tx = await market.createMarket(m.question, duration);
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
