import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    // 1. The address from check-all-contracts.js "LATEST_DEPLOY"
    const MARKET_ADDRESS_V2 = "0xB6a211822649a61163b94cf46e6fCE46119D3E1b";
    // 2. The address that definitely responded to owner() calls in Step 1843
    const MARKET_ADDRESS_OLD = "0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6";

    // LOAD KEY FROM ENV
    const privateKey = process.env.ADMIN_KEY;
    if (!privateKey) {
        console.error("❌ Error: ADMIN_KEY not found in .env file.");
        console.error("Please add ADMIN_KEY=<your_private_key> to your .env file.");
        process.exit(1);
    }

    // Explicitly use BSC Mainnet RPC to avoid any default network issues
    const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
    const adminWallet = new ethers.Wallet(privateKey, provider);

    console.log("-----------------------------------------");
    console.log("👑 Creating 5-hour market as Admin/Owner");
    console.log("Admin Account:", adminWallet.address);

    let targetMarket = null;
    let targetAddress = "";

    // Try V2 Address first
    try {
        console.log(`Checking Latest Address: ${MARKET_ADDRESS_V2}`);
        const market = await ethers.getContractAt("PredictionMarketMultiV2", MARKET_ADDRESS_V2, adminWallet);
        const owner = await market.owner();
        console.log("  -> Contract Owner:", owner);

        if (owner.toLowerCase() === adminWallet.address.toLowerCase()) {
            console.log("  ✅ MATCH! Using Latest Address.");
            targetMarket = market;
            targetAddress = MARKET_ADDRESS_V2;
        } else {
            console.log("  ❌ Mismatch. Admin is not owner.");
        }
    } catch (e: any) {
        console.log(`  ⚠️ Error checking Latest: ${e.code || e.message}`);
    }

    // If V2 failed, try OLD address
    if (!targetMarket) {
        try {
            console.log(`Checking Fallback Address: ${MARKET_ADDRESS_OLD}`);
            const market = await ethers.getContractAt("PredictionMarketMultiV2", MARKET_ADDRESS_OLD, adminWallet);
            const owner = await market.owner();
            console.log("  -> Contract Owner:", owner);

            if (owner.toLowerCase() === adminWallet.address.toLowerCase()) {
                console.log("  ✅ MATCH! Using Fallback Address.");
                targetMarket = market;
                targetAddress = MARKET_ADDRESS_OLD;
            } else {
                console.log("  ❌ Mismatch. Admin is not owner.");
            }
        } catch (e: any) {
            console.log(`  ⚠️ Error checking Fallback: ${e.code || e.message}`);
        }
    }

    if (!targetMarket) {
        console.error("\n❌ Could not find a contract owned by this key.");
        return;
    }

    // CREATE MARKET
    // 5 Hours in seconds
    const durationSeconds = 5 * 60 * 60;

    const question = "Will BTC be above $100k in 5 hours?";
    const image = "/images/btc.png";
    const description = "Market resolves based on Binance BTC/USDT spot price.";
    const outcomes = ["Yes", "No"];
    const liquidity = ethers.parseUnits("1000", 18);
    const subsidy = 0;

    console.log("-----------------------------------------");
    console.log(`Creating Market on: ${targetAddress}`);
    console.log(`Question: "${question}"`);
    console.log(`Duration: ${durationSeconds}s (5h)`);
    console.log("Liquidity:", ethers.formatUnits(liquidity, 18), "USDC");
    console.log("-----------------------------------------");

    try {
        // Use Legacy createMarket (V1) signature
        const tx = await targetMarket.createMarket(
            question,
            image,
            description,
            outcomes,
            durationSeconds,
            liquidity,
            subsidy,
            { gasLimit: 5000000 } // Explicit gas limit
        );

        console.log("Transaction sent:", tx.hash);
        console.log("Waiting for confirmation...");

        await tx.wait();
        console.log("✅ Market created successfully!");

    } catch (error: any) {
        console.error("❌ Execution failed:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
