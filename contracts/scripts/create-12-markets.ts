import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    const marketAddress = process.env.MULTI_MARKET_ADDRESS || process.env.MARKET_CONTRACT;

    if (!marketAddress) {
        throw new Error("MARKET_CONTRACT not set in .env");
    }

    console.log("\n🔍 Checking Contract State...");
    console.log("Contract:", marketAddress);
    console.log("Deployer:", deployer.address);

    const market = await ethers.getContractAt("PredictionMarketMultiV2", marketAddress);

    // Check current state
    const currentCount = await market.marketCount();
    console.log(`Current market count: ${currentCount}`);

    // Try to read existing markets
    console.log("\n📋 Checking existing markets...");
    for (let i = 0; i < Number(currentCount); i++) {
        try {
            const outcomes = await market.getMarketOutcomes(i);
            console.log(`  Market ${i}: ✅ Readable (${outcomes.length} outcomes)`);
        } catch (e: any) {
            console.log(`  Market ${i}: ❌ Deleted or corrupted`);
        }
    }

    const markets = [
        {
            question: "Will Tesla lose its #1 position in global EV sales by 2026?",
            outcomes: ["Yes - BYD", "Yes - VW", "Yes - Other", "No - Tesla Remains #1"],
            durationDays: 365
        },
        {
            question: "Will a permanent lunar base be established by 2030?",
            outcomes: ["Yes", "No"],
            durationDays: 1400
        },
        {
            question: "Which artist will win Album of the Year at 2026 Grammys?",
            outcomes: ["Taylor Swift", "Beyoncé", "Drake", "Bad Bunny", "Billie Eilish", "Other"],
            durationDays: 300
        },
        {
            question: "Will lab-grown meat reach 10% of US meat market by 2028?",
            outcomes: ["Yes", "No"],
            durationDays: 1000
        },
        {
            question: "Will US median home prices drop below $350k in 2025?",
            outcomes: ["Yes - Q1", "Yes - Q2", "Yes - Q3", "Yes - Q4", "No"],
            durationDays: 250
        },
        {
            question: "Will mRNA cancer vaccines be FDA approved by 2027?",
            outcomes: ["Yes", "No"],
            durationDays: 900
        },
        {
            question: "Which luxury brand will have highest market cap in 2026?",
            outcomes: ["LVMH", "Hermès", "Kering", "Richemont", "Prada", "Other"],
            durationDays: 500
        },
        {
            question: "Will online degrees surpass traditional degrees in US by 2029?",
            outcomes: ["Yes", "No"],
            durationDays: 1200
        },
        {
            question: "Will commercial fusion power plant be operational by 2035?",
            outcomes: ["Yes", "No"],
            durationDays: 3000
        },
        {
            question: "Will commercial supersonic flights resume by 2027?",
            outcomes: ["Yes", "No"],
            durationDays: 900
        },
        {
            question: "Which social platform will have most daily active users in 2026?",
            outcomes: ["TikTok", "Instagram", "Facebook", "YouTube", "X (Twitter)", "Other"],
            durationDays: 500
        },
        {
            question: "Will humanoid robots be commercially available for home use by 2028?",
            outcomes: ["Yes", "No"],
            durationDays: 1100
        }
    ];

    console.log(`\n🚀 Creating ${markets.length} fresh markets...\n`);

    const created: number[] = [];
    const failed: number[] = [];

    for (let i = 0; i < markets.length; i++) {
        const m = markets[i];
        try {
            console.log(`[${i + 1}/${markets.length}] Creating: ${m.question.substring(0, 50)}...`);

            const tx = await market.createMarket(m.question, m.outcomes, m.durationDays);
            const receipt = await tx.wait();

            // Verify it was created
            const newCount = await market.marketCount();
            const marketId = Number(newCount) - 1;

            // Test reading it immediately
            const outcomes = await market.getMarketOutcomes(marketId);
            const prices = await market.getAllPrices(marketId);

            console.log(`  ✅ Market ${marketId} created and verified`);
            console.log(`     Outcomes: ${outcomes.join(', ')}`);
            console.log(`     Prices: ${prices.map((p: bigint) => (Number(p) / 100).toFixed(1) + '%').join(', ')}`);
            console.log(`     TX: ${receipt.hash}\n`);

            created.push(marketId);
        } catch (error: any) {
            console.error(`  ❌ Failed: ${error.message}\n`);
            failed.push(i);
        }
    }

    console.log("\n============================================================");
    console.log("MARKET CREATION COMPLETE");
    console.log("============================================================\n");
    console.log(`✅ Successfully created: ${created.length} markets`);
    console.log(`   Market IDs: ${created.join(', ')}`);
    console.log(`❌ Failed: ${failed.length} markets`);
    if (failed.length > 0) {
        console.log(`   Indices: ${failed.join(', ')}`);
    }

    // Final verification
    const finalCount = await market.marketCount();
    console.log(`\n📊 Final market count: ${finalCount}`);

    console.log("\n✨ Markets are ready for testing!");
    console.log("   Try placing a bet and verify prices update correctly.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
