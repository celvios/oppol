import { ethers } from "hardhat";

async function main() {
    // Address from client/lib/contracts.ts (BSC Testnet)
    const MARKET_ADDRESS = "0x0d0279825957d13c74E6C187Cc37D502E0c3D168";

    const [deployer] = await ethers.getSigners();
    console.log("Creating metadata-ready markets with account:", deployer.address);
    console.log("Target Contract:", MARKET_ADDRESS);

    // Using PredictionMarketUMA as per previous scripts
    const market = await ethers.getContractAt("PredictionMarketUMA", MARKET_ADDRESS);

    const markets = [
        {
            question: "Will Bitcoin reach $150,000 by April 2026?",
            durationDays: 450, // Approx to April 2026 from Jan 2025
            liquidity: 1000,
            subsidy: 0
        },
        {
            question: "Will Apple release AR glasses in 2026?",
            durationDays: 365,
            liquidity: 1000,
            subsidy: 0
        }
    ];

    for (const m of markets) {
        const duration = m.durationDays * 24 * 60 * 60;
        const liquidityUnits = ethers.parseUnits(m.liquidity.toString(), 6);
        const subsidyUnits = ethers.parseUnits(m.subsidy.toString(), 6);

        console.log(`\nCreating: "${m.question}"`);
        try {
            const tx = await market.createMarket(m.question, duration, liquidityUnits, subsidyUnits);
            console.log(`  Tx sent: ${tx.hash}`);
            await tx.wait();
            console.log(`  ✅ Market Created`);
        } catch (e) {
            console.error(`  ❌ Failed:`, e);
        }
    }

    const count = await market.marketCount();
    console.log(`\nTotal Markets: ${count}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
