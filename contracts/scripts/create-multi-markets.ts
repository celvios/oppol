import { ethers } from "hardhat";

async function main() {
    // UPDATE THIS AFTER DEPLOYMENT
    const MARKET_ADDRESS = "0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6";

    const [deployer] = await ethers.getSigners();
    console.log("Creating multi-outcome markets with:", deployer.address);

    const market = await ethers.getContractAt("PredictionMarketMulti", MARKET_ADDRESS);

    // 12 diverse multi-outcome markets
    const markets = [
        // CRYPTO (3)
        {
            question: "What will BTC price be at end of 2026?",
            outcomes: ["Under $80k", "$80k-$120k", "$120k-$200k", "Over $200k"],
            durationDays: 365,
            liquidity: 1000,
            category: "Crypto"
        },
        {
            question: "Which L1 will have highest TVL in Q4 2026?",
            outcomes: ["Ethereum", "Solana", "BSC", "Avalanche", "Other"],
            durationDays: 365,
            liquidity: 800,
            category: "Crypto"
        },
        {
            question: "What will SOL price be at end of 2025?",
            outcomes: ["Under $100", "$100-$300", "$300-$500", "Over $500"],
            durationDays: 365,
            liquidity: 600,
            category: "Crypto"
        },

        // SPORTS (2)
        {
            question: "Who will win AFCON 2025?",
            outcomes: ["Nigeria", "Morocco", "Egypt", "Senegal", "Other"],
            durationDays: 180,
            liquidity: 500,
            category: "Sports"
        },
        {
            question: "Who will win the 2026 FIFA World Cup?",
            outcomes: ["Brazil", "France", "Argentina", "Germany", "England", "Other"],
            durationDays: 730,
            liquidity: 1000,
            category: "Sports"
        },

        // POLITICS (2)
        {
            question: "Who will win 2028 US Presidential Election?",
            outcomes: ["Republican", "Democrat", "Independent", "Other"],
            durationDays: 1095,
            liquidity: 800,
            category: "Politics"
        },
        {
            question: "Which party wins UK next general election?",
            outcomes: ["Conservative", "Labour", "Liberal Democrats", "Other"],
            durationDays: 730,
            liquidity: 600,
            category: "Politics"
        },

        // ENTERTAINMENT (2)
        {
            question: "Which movie will gross highest in 2026?",
            outcomes: ["Avatar 4", "Marvel Film", "DC Film", "Original IP", "Other"],
            durationDays: 365,
            liquidity: 500,
            category: "Entertainment"
        },
        {
            question: "Who will win Grammy Album of the Year 2026?",
            outcomes: ["Drake", "Taylor Swift", "Kendrick Lamar", "The Weeknd", "Other"],
            durationDays: 365,
            liquidity: 500,
            category: "Entertainment"
        },

        // TECH (2)
        {
            question: "Which AI company will lead benchmarks in 2026?",
            outcomes: ["OpenAI", "Google DeepMind", "Anthropic", "Meta AI", "Other"],
            durationDays: 365,
            liquidity: 700,
            category: "Tech"
        },
        {
            question: "Which company releases consumer AR glasses first?",
            outcomes: ["Apple", "Meta", "Google", "Samsung", "Other"],
            durationDays: 730,
            liquidity: 600,
            category: "Tech"
        },

        // SCIENCE (1)
        {
            question: "What will global temperature anomaly be in 2026?",
            outcomes: ["Under 1.5°C", "1.5°C-1.8°C", "1.8°C-2.0°C", "Over 2.0°C"],
            durationDays: 365,
            liquidity: 500,
            category: "Science"
        },
    ];

    console.log(`\n📊 Creating ${markets.length} multi-outcome markets...\n`);

    for (let i = 0; i < markets.length; i++) {
        const m = markets[i];
        const duration = m.durationDays * 24 * 60 * 60; // Convert days to seconds
        const liquidityUnits = ethers.parseUnits(m.liquidity.toString(), 6);

        console.log(`[${i + 1}/${markets.length}] Creating: "${m.question.slice(0, 50)}..."`);
        console.log(`    Category: ${m.category}`);
        console.log(`    Outcomes: ${m.outcomes.join(", ")}`);
        console.log(`    Duration: ${m.durationDays} days, Liquidity: ${m.liquidity}`);

        try {
            const tx = await market.createMarket(
                m.question,
                m.outcomes,
                duration,
                liquidityUnits,
                0 // No subsidy
            );
            await tx.wait();
            console.log(`    ✅ Created (tx: ${tx.hash.slice(0, 20)}...)\n`);
        } catch (error: any) {
            console.log(`    ❌ Failed: ${error.message}\n`);
        }
    }

    const count = await market.marketCount();
    console.log(`\n=== Total Multi-Outcome Markets: ${count} ===`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
