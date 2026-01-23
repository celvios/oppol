const { ethers } = require("hardhat");

async function main() {
    const MARKET_ADDRESS = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";

    // We'll use the V2 interface to check the state variables
    // If it's a proxy, this should work against the proxy address
    const market = await ethers.getContractAt("PredictionMarketMultiV2", MARKET_ADDRESS);

    console.log("Checking contract state for:", MARKET_ADDRESS);

    try {
        const token = await market.creationToken();
        console.log("Creation Token Address:", token);

        if (token === "0x0000000000000000000000000000000000000000") {
            console.log("⚠️ Creation Token is NOT set (AddressZero)");
        } else {
            console.log("✅ Creation Token is SET");

            // Try to identify if it's acting as an NFT or Token
            const minBalance = await market.minCreationBalance();
            console.log("Min Balance Required:", minBalance.toString());
        }
    } catch (error) {
        console.error("Could not read creationToken. The contract might not be upgraded to V2 yet, or ABI mismatch.");
        console.error("Error:", error.message);
    }

    try {
        const isPublic = await market.publicCreation();
        console.log("Public Creation Enabled:", isPublic);
    } catch (error) {
        console.log("Could not read publicCreation.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
