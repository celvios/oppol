import { ethers } from "hardhat";

async function main() {
    const MARKET_ADDRESS = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    const NEW_OWNER = "0xa4B1B886f955b2342bC9bB4f7B80839357378b76"; // The address getting the error

    const [deployer] = await ethers.getSigners();
    console.log("Transferring ownership...");
    console.log("Contract:", MARKET_ADDRESS);
    console.log("From (Deployer):", deployer.address);
    console.log("To (User):", NEW_OWNER);

    const market = await ethers.getContractAt("PredictionMarketMultiV2", MARKET_ADDRESS);

    // Check current owner if possible
    try {
        const currentOwner = await market.owner();
        console.log("Current Owner:", currentOwner);
        if (currentOwner.toLowerCase() === NEW_OWNER.toLowerCase()) {
            console.log("Target is already the owner.");
            return;
        }
        if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
            console.error("❌ Deployer is NOT the owner. Cannot transfer.");
            return;
        }
    } catch (e) {
        console.log("Warning: Could not fetch current owner (check network/ABI). Attempting transfer anyway...");
    }

    const tx = await market.transferOwnership(NEW_OWNER);
    console.log("Tx sent:", tx.hash);
    await tx.wait();
    console.log("✅ Ownership transferred successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
