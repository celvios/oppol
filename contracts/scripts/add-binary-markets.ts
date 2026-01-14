import { ethers } from "hardhat";

async function main() {
    const MARKET_ADDRESS = "0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6";

    const [deployer] = await ethers.getSigners();
    console.log("Adding binary markets (as 2-outcome) with:", deployer.address);

    const market = await ethers.getContractAt("PredictionMarketMulti", MARKET_ADDRESS);

    // Convert existing 3 binary markets to 2-outcome format
    const binaryMarkets = [
        {
            question: "Will BTC reach $100k by end of 2026?",
            outcomes: ["Yes", "No"],
            durationDays: 365,
            liquidity: 1000
        },
        {
            question: "Will ETH reach $10k by end of 2026?",
            outcomes: ["Yes", "No"],
            durationDays: 365,
            liquidity: 500
        },
        {
            question: "Will BNB reach $1000 by Q2 2026?",
            outcomes: ["Yes", "No"],
            durationDays: 180,
            liquidity: 400
        },
    ];

    console.log(`\n📊 Adding ${binaryMarkets.length} binary markets as 2-outcome format...\n`);

    for (let i = 0; i < binaryMarkets.length; i++) {
        const m = binaryMarkets[i];
        const duration = m.durationDays * 24 * 60 * 60;
        const liquidityUnits = ethers.parseUnits(m.liquidity.toString(), 6);

        console.log(`[${i + 1}/${binaryMarkets.length}] Creating: "${m.question}"`);
        console.log(`    Outcomes: ${m.outcomes.join(", ")}`);

        try {
            const tx = await market.createMarket(
                m.question,
                m.outcomes,
                duration,
                liquidityUnits,
                0
            );
            await tx.wait();
            console.log(`    ✅ Created\n`);
        } catch (error: any) {
            console.log(`    ❌ Failed: ${error.message}\n`);
        }
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
