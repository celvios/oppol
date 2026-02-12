import { ethers } from "hardhat";

async function main() {
    const MARKET_ADDRESS = "0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6";
    const [deployer] = await ethers.getSigners();

    console.log("-----------------------------------------");
    console.log("🚀 Creating 5-hour market");
    console.log("Account:", deployer.address);
    console.log("Market Contract:", MARKET_ADDRESS);

    const market = await ethers.getContractAt("PredictionMarketMulti", MARKET_ADDRESS);

    try {
        const owner = await market.owner();
        console.log("Contract Owner:", owner);

        if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
            console.error("❌ ERROR: Deployer is NOT the contract owner!");
            console.error("Legacy createMarket (allowing seconds duration) is restricted to onlyOwner.");
            console.error("Cannot create a 5-hour market with this account.");
            return;
        } else {
            console.log("✅ Verified: Deployer is Owner.");
        }

        // 5 Hours in seconds
        const durationSeconds = 5 * 60 * 60;

        const question = "Will BTC be above $100k in 5 hours?";
        const image = "/images/btc.png";
        const description = "Market resolves based on Binance BTC/USDT spot price.";
        const outcomes = ["Yes", "No"];
        const liquidity = ethers.parseUnits("1000", 18);
        const subsidy = 0;

        console.log("-----------------------------------------");
        console.log(`Question: "${question}"`);
        console.log(`Outcomes: [${outcomes.join(", ")}]`);
        console.log(`Duration: ${durationSeconds}s (5h)`);
        console.log("Liquidity:", ethers.formatUnits(liquidity, 18), "USDC");
        console.log("-----------------------------------------");

        // Explicit gas limit to prevent estimation errors from masking the revert reason
        const tx = await market.createMarket(
            question,
            image,
            description,
            outcomes,
            durationSeconds,
            liquidity,
            subsidy,
            { gasLimit: 5000000 }
        );

        console.log("Transaction sent:", tx.hash);
        console.log("Waiting for confirmation...");

        await tx.wait();
        console.log("✅ Market created successfully!");

        const count = await market.marketCount();
        console.log(`Total Markets: ${count}`);

    } catch (error: any) {
        console.error("❌ Execution failed:", error);
        if (error.data) {
            console.error("Revert Data:", error.data);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
