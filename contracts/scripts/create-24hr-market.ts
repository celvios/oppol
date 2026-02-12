import { ethers } from "hardhat";

async function main() {
    const MARKET_ADDRESS = "0xB6a211822649a61163b94cf46e6fCE46119D3E1b";
    const [deployer] = await ethers.getSigners();

    console.log("-----------------------------------------");
    console.log("🚀 Creating 24-hour market (Minimum Duration)");
    console.log("Account:", deployer.address);
    console.log("Market Contract:", MARKET_ADDRESS);

    const market = await ethers.getContractAt("PredictionMarketMultiV2", MARKET_ADDRESS);

    // 1 Day (Minimum for V2)
    const durationDays = 1;

    const question = "Will BTC be above $100k in 24 hours?";
    const image = "/images/btc.png";
    const description = "Market resolves based on Binance BTC/USDT spot price.";
    const outcomes = ["Yes", "No"];

    // In V2, we don't pass liquidity or subsidy.
    // function createMarket(question, image, description, outcomes, durationDays)

    console.log("-----------------------------------------");
    console.log(`Question: "${question}"`);
    console.log(`Outcomes: [${outcomes.join(", ")}]`);
    console.log(`Duration: ${durationDays} Day(s)`);
    console.log("-----------------------------------------");

    try {
        const tx = await market.createMarket(
            question,
            image,
            description,
            outcomes,
            durationDays
            // No liquidity/subsidy args for V2 public creation
        );

        console.log("Transaction sent:", tx.hash);
        console.log("Waiting for confirmation...");

        await tx.wait();
        console.log("✅ Market created successfully!");

        const count = await market.marketCount();
        console.log(`Total Markets: ${count}`);

    } catch (error: any) {
        console.error("❌ Execution failed:", error.message);
        if (error.message.includes("resolution")) {
            console.log("Hint: Try using the legacy function if you are owner?");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
