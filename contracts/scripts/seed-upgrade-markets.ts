import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    const [deployer] = await ethers.getSigners();
    // Use the address directly from our recent deployment
    const marketAddress = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";

    console.log("\n🌱 Seeding Markets on Mainnet...");
    console.log("Contract:", marketAddress);
    console.log("Deployer:", deployer.address);

    const market = await ethers.getContractAt("PredictionMarketMulti", marketAddress);

    // Common params
    const LIQUIDITY_PARAM = ethers.parseEther("1000"); // b parameter (Higher = less price impact)
    const SUBSIDY = 0;

    const markets = [
        {
            question: "Will Bitcoin hit $100k in 2025?",
            image: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&q=80&w=1000",
            description: "Market resolves to 'Yes' if Bitcoin trades above $100,000 USD on major exchanges at any point in 2025.",
            outcomes: ["Yes", "No"],
            durationSeconds: 365 * 24 * 60 * 60
        },
        {
            question: "Who will win the 2026 World Cup?",
            image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&q=80&w=1000",
            description: "Winner of the 2026 FIFA World Cup which will be hosted by Canada, Mexico, and the United States.",
            outcomes: ["France", "Brazil", "Argentina", "England", "Spain", "Other"],
            durationSeconds: 500 * 24 * 60 * 60
        },
        {
            question: "Will SpaceX land humans on Mars by 2030?",
            image: "https://images.unsplash.com/photo-1541873676-a18131494184?auto=format&fit=crop&q=80&w=1000",
            description: "Resolves to 'Yes' if SpaceX successfully lands a human crew on the surface of Mars before Jan 1, 2031.",
            outcomes: ["Yes", "No"],
            durationSeconds: 1500 * 24 * 60 * 60
        },
        {
            question: "Will GPT-5 be released before 2026?",
            image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1000",
            description: "Resolves to 'Yes' if OpenAI publicly releases a model explicitly named 'GPT-5' before Jan 1, 2026.",
            outcomes: ["Yes", "No"],
            durationSeconds: 200 * 24 * 60 * 60
        }
    ];

    console.log(`\n🚀 Creating ${markets.length} fresh markets...\n`);

    for (let i = 0; i < markets.length; i++) {
        const m = markets[i];
        try {
            console.log(`[${i + 1}/${markets.length}] Creating: ${m.question}`);

            // New Signature: createMarket(question, image, description, outcomes, duration, liquidityParam, subsidy)
            const tx = await market.createMarket(
                m.question,
                m.image,
                m.description,
                m.outcomes,
                m.durationSeconds,
                LIQUIDITY_PARAM,
                SUBSIDY
            );

            console.log(`   Tx sent: ${tx.hash}`);
            await tx.wait();
            console.log(`   ✅ Confirmed!\n`);

        } catch (error: any) {
            console.error(`  ❌ Failed: ${error.message}\n`);
        }
    }

    const count = await market.marketCount();
    console.log(`\n🎉 Done! Total markets: ${count}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
