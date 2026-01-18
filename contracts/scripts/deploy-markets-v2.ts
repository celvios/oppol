import { ethers } from "hardhat";

async function main() {
    console.log("\n✨ Creating Markets on V2.1 Contract (Fixed LMSR)");
    console.log("=".repeat(60));

    const [deployer] = await ethers.getSigners();
    const contractAddress = "0x221C4CFADE97b5d3D8C1016C3FbAe3C23eC79772"; // V2.1 UUPS Proxy

    console.log("Deployer:", deployer.address);
    console.log("Contract:", contractAddress);

    const market = await ethers.getContractAt("PredictionMarketMultiV2", contractAddress);

    // Verify we're owner
    const owner = await market.owner();
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
        throw new Error(`Not owner! Owner is ${owner}`);
    }
    console.log("✅ Owner verified\n");

    const markets = [
        {
            question: "Will Tesla lose its #1 position in global EV sales by 2026?",
            outcomes: ["Yes - BYD", "Yes - VW", "Yes - Other", "No - Tesla Remains #1"],
            days: 365
        },
        {
            question: "Will a permanent lunar base be established by 2030?",
            outcomes: ["Yes", "No"],
            days: 1400
        },
        {
            question: "Which artist will win Album of the Year at 2026 Grammys?",
            outcomes: ["Taylor Swift", "Beyoncé", "Drake", "Bad Bunny", "Billie Eilish", "Other"],
            days: 300
        },
        {
            question: "Will lab-grown meat reach 10% of US meat market by 2028?",
            outcomes: ["Yes", "No"],
            days: 1000
        },
        {
            question: "Will US median home prices drop below $350k in 2025?",
            outcomes: ["Yes - Q1", "Yes - Q2", "Yes - Q3", "Yes - Q4", "No"],
            days: 250
        },
        {
            question: "Will mRNA cancer vaccines be FDA approved by 2027?",
            outcomes: ["Yes", "No"],
            days: 900
        },
        {
            question: "Which luxury brand will have highest market cap in 2026?",
            outcomes: ["LVMH", "Hermès", "Kering", "Richemont", "Prada", "Other"],
            days: 500
        },
        {
            question: "Will online degrees surpass traditional degrees in US by 2029?",
            outcomes: ["Yes", "No"],
            days: 1200
        },
        {
            question: "Will commercial fusion power plant be operational by 2035?",
            outcomes: ["Yes", "No"],
            days: 3000
        },
        {
            question: "Will commercial supersonic flights resume by 2027?",
            outcomes: ["Yes", "No"],
            days: 900
        },
        {
            question: "Which social platform will have most daily active users in 2026?",
            outcomes: ["TikTok", "Instagram", "Facebook", "YouTube", "X (Twitter)", "Other"],
            days: 500
        },
        {
            question: "Will humanoid robots be commercially available for home use by 2028?",
            outcomes: ["Yes", "No"],
            days: 1100
        }
    ];

    console.log(`Creating ${markets.length} markets...\n`);

    const startCount = await market.marketCount();
    console.log(`Starting market count: ${startCount}\n`);

    for (let i = 0; i < markets.length; i++) {
        const m = markets[i];
        try {
            console.log(`[${i + 1}/${markets.length}] ${m.question.substring(0, 60)}...`);

            // Use the V2 3-parameter createMarket function
            const tx = await market.createMarket(m.question, m.outcomes, m.days);
            const receipt = await tx.wait();

            const marketId = Number(await market.marketCount()) - 1;
            console.log(`    ✅ Market ID ${marketId} | TX: ${receipt.hash.substring(0, 10)}...\n`);

        } catch (error: any) {
            console.log(`    ❌ Failed: ${error.message}\n`);
        }
    }

    const finalCount = await market.marketCount();
    console.log("=".repeat(60));
    console.log(`Final market count: ${finalCount}`);
    console.log(`Created: ${Number(finalCount) - Number(startCount)} new markets`);
    console.log("\n🎉 Done! Markets ready for testing.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
