const { ethers } = require("hardhat");

async function main() {
    const marketDetails = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";

    // We can use a generic ABI to check owner and other fields
    const abi = [
        "function owner() view returns (address)",
        "function publicCreation() view returns (bool)",
        "function creationToken() view returns (address)",
        "function minCreationBalance() view returns (uint256)"
    ];

    // Use a provider directly if possible to avoid some Hardhat overhead/middleware issues
    // But we'll stick to ethers.getContractAt for convenience with Hardhat's provider wrapper

    try {
        const [signer] = await ethers.getSigners();
        console.log("Signer address:", signer.address);

        const contract = new ethers.Contract(marketDetails, abi, signer);

        console.log("Checking contract at:", marketDetails);

        try {
            const owner = await contract.owner();
            console.log("Contract Owner:", owner);
        } catch (e) {
            console.error("Failed to get owner:", e.shortMessage || e.message);
        }

        try {
            const publicCreation = await contract.publicCreation();
            console.log("Public Creation Enabled:", publicCreation);
        } catch (e) {
            console.error("Failed to get publicCreation:", e.shortMessage || e.message);
        }

        try {
            const token = await contract.creationToken();
            console.log("Creation Token:", token);
        } catch (e) {
            // It might not exist if it's an old contract
            console.error("Failed to get creationToken:", e.shortMessage || e.message);
        }

    } catch (error) {
        console.error("Setup error:", error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
