import { ethers } from "hardhat";

async function main() {
    const MARKET_ADDRESS = "0xbBE2811Ab064bd76667D49346a025530310AD03E";

    const [deployer] = await ethers.getSigners();
    console.log("Creating markets with:", deployer.address);

    const market = await ethers.getContractAt("PredictionMarketUMA", MARKET_ADDRESS);

    const markets = [
        // CRYPTO
        { question: "Will Bitcoin reach $150,000 by April 2026?", durationDays: 365, liquidity: 1000, subsidy: 0 },
        { question: "Will Ethereum flip Bitcoin by market cap before 2027?", durationDays: 730, liquidity: 500, subsidy: 0 },
        
        // TECH
        { question: "Will Apple release AR glasses in 2026?", durationDays: 365, liquidity: 500, subsidy: 0 },
        { question: "Will AI replace 50% of software jobs by 2030?", durationDays: 1825, liquidity: 500, subsidy: 0 },
        { question: "Will SpaceX land humans on Mars by 2028?", durationDays: 1095, liquidity: 500, subsidy: 0 },
        
        // SPORTS
        { question: "Will Messi win another Ballon d'Or in 2025?", durationDays: 365, liquidity: 300, subsidy: 0 },
        { question: "Will an African team win the World Cup by 2030?", durationDays: 1825, liquidity: 300, subsidy: 0 },
        
        // POLITICS
        { question: "Will Trump win the 2024 US Presidential Election?", durationDays: 90, liquidity: 800, subsidy: 0 },
        { question: "Will UK rejoin the EU by 2030?", durationDays: 1825, liquidity: 400, subsidy: 0 },
        
        // ENTERTAINMENT
        { question: "Will GTA 6 release in 2025?", durationDays: 365, liquidity: 400, subsidy: 0 },
        { question: "Will Avatar 3 gross over $2 billion worldwide?", durationDays: 730, liquidity: 400, subsidy: 0 },
        
        // SCIENCE
        { question: "Will fusion energy be commercially viable by 2030?", durationDays: 1825, liquidity: 500, subsidy: 0 },
        { question: "Will a quantum computer break RSA-2048 by 2028?", durationDays: 1095, liquidity: 500, subsidy: 0 },
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
