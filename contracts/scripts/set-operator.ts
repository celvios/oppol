import { ethers } from "hardhat";

async function main() {
    // 1. Configuration
    const MARKET_ADDRESS = "0xbBE2811Ab064bd76667D49346a025530310AD03E"; // Deployed address

    // Get server wallet (operator) from env or use deployer
    const [deployer] = await ethers.getSigners();
    let OPERATOR_ADDRESS = process.env.SERVER_WALLET || deployer.address;

    // OR manually override here if needed:
    // OPERATOR_ADDRESS = "YOUR_SERVER_WALLET_ADDRESS";

    console.log("Checking operator status for:", OPERATOR_ADDRESS);
    console.log("On Market Contract:", MARKET_ADDRESS);

    // 2. Attach to Contract
    const PredictionMarketUMA = await ethers.getContractFactory("PredictionMarketUMA");
    const market = PredictionMarketUMA.attach(MARKET_ADDRESS) as any;

    // 3. Check Status
    const isOperator = await market.operators(OPERATOR_ADDRESS);
    console.log(`Current Status: ${isOperator ? "✅ AUTHORIZED" : "❌ NOT AUTHORIZED"}`);

    if (isOperator) {
        console.log("Server wallet is already an operator. No action needed.");
        return;
    }

    // 4. Set Operator (if not set)
    console.log("Authorizing operator...");
    try {
        const tx = await market.setOperator(OPERATOR_ADDRESS, true);
        console.log("Transaction sent:", tx.hash);
        await tx.wait();
        console.log("✅ Success! Server wallet is now an authorized operator.");
    } catch (error) {
        console.error("Failed to set operator:", error);
        console.log("Make sure you are using the owner wallet to run this script.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
