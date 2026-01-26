import { ethers } from "hardhat";

async function main() {
    const ADDRESS = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    console.log(`Checking contract at ${ADDRESS} on BSC Mainnet...`);

    // Minimal ABI for V2's token gating
    const ABI = [
        "function creationToken() view returns (address)",
        "function minCreationBalance() view returns (uint256)",
        "function publicCreation() view returns (bool)",
        "function owner() view returns (address)"
    ];

    const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
    const contract = new ethers.Contract(ADDRESS, ABI, provider);

    try {
        console.log("Attempting to read 'creationToken'...");
        const token = await contract.creationToken();
        console.log(`✅ Success! creationToken = ${token}`);

        const minBal = await contract.minCreationBalance();
        console.log(`   minCreationBalance = ${minBal}`);

        const isPublic = await contract.publicCreation();
        console.log(`   publicCreation = ${isPublic}`);

    } catch (e: any) {
        console.log("❌ Failed to read 'creationToken'.");
        console.log("   Reason:", e.code || e.message);
        console.log("   Conclusion: This is likely the V1 contract (No Token Gating).");
    }

    try {
        const owner = await contract.owner();
        console.log(`\nContract Owner: ${owner}`);
    } catch (e) {
        console.log("Could not read owner.");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
