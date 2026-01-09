import { ethers } from "hardhat";

async function main() {
    // Read contracts from artifacts
    console.log("Getting contract info from latest deployment...\n");

    // These are placeholder - user would need to replace with actual deployed addresses
    // from the last deployment output
    console.log("Check your terminal output from the last 'deploy-bsc-testnet.ts' run");
    console.log("Look for lines containing:");
    console.log("  MockUSDC deployed to: 0x...");
    console.log("  PredictionMarketUMA deployed to: 0x...");
}

main().catch(console.error);
