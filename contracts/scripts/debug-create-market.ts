import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    const marketAddress = "0xfB661CBD10188c2619CAe6b07f34204062EfbB6C";

    console.log("Deployer:", deployer.address);
    console.log("Attempting to create single test market...\n");

    const market = await ethers.getContractAt("PredictionMarketMultiV2", marketAddress);

    // Get gas estimate first
    try {
        const gasEstimate = await market.createMarket.estimateGas(
            "Test Market?",
            ["Yes", "No"],
            30
        );
        console.log("Gas estimate:", gasEstimate.toString());
    } catch (error: any) {
        console.error("Gas estimation failed:");
        console.error("Error data:", error.data);
        console.error("Error reason:", error.reason);
        console.error("Full error:", JSON.stringify(error, null, 2));

        // Try to decode the revert reason
        if (error.data) {
            try {
                const reason = ethers.toUtf8String('0x' + error.data.slice(138));
                console.error("Decoded reason:", reason);
            } catch (e) {
                console.error("Could not decode error data");
            }
        }
        return;
    }

    // If gas estimation worked, try actual transaction
    console.log("\nSending transaction...");
    const tx = await market.createMarket("Test Market?", ["Yes", "No"], 30);
    console.log("TX sent:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ Market created! Block:", receipt.blockNumber);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Fatal error:");
        console.error(error);
        process.exit(1);
    });
