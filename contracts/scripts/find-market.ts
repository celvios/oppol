import { ethers } from "hardhat";

async function main() {
    console.log("🔍 Looking for recently deployed PredictionMarketUMA...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Using account:", deployer.address);

    // Get transaction count to find recent deployments
    const txCount = await deployer.getNonce();
    console.log("Transaction count:", txCount);

    // Try likely recent addresses based on nonce pattern
    // The deploy script deploys: MockUSDC, MockOracle, Market, Zap
    // So Market is typically nonce - 2 (before Zap)

    // Let's try to find by probing known patterns
    const possibleAddresses = [
        "0x4b7951815a303aD59733A3c775AcF37d54be948f", // Old
        "0x15f9e95A2724F13A6f7d207576FaE1" // Partial from output
    ];

    for (const addr of possibleAddresses) {
        try {
            const code = await ethers.provider.getCode(addr);
            if (code !== "0x") {
                console.log(`✅ Found contract at: ${addr}`);
            }
        } catch (e) {
            // Invalid address format
        }
    }

    // Better approach: just use the last known working address or redeploy
    console.log("\nTo find exact address, check deployment output or use a new deploy.");
}

main().catch(console.error);
