import { ethers } from "hardhat";

async function main() {
    console.log("=== Contract Verification Script ===\n");

    const MARKET_ADDRESS = "0xbBE2811Ab064bd76667D49346a025530310AD03E";
    const TEST_USER = "0x0ba11b3d7026A6c7F8d333791AA7ce2b7845F6Db";

    console.log(`Contract: ${MARKET_ADDRESS}`);
    console.log(`Test User: ${TEST_USER}\n`);

    // 1. Check if address has code (is a contract)
    const provider = ethers.provider;
    const code = await provider.getCode(MARKET_ADDRESS);
    console.log(`1. Contract Code: ${code.length > 2 ? `✅ Found (${code.length} bytes)` : "❌ NO CODE"}`);

    if (code.length <= 2) {
        console.log("\n❌ CRITICAL: No contract exists at this address!");
        console.log("   This could mean:");
        console.log("   - The contract was never deployed");
        console.log("   - You're on the wrong network");
        console.log("   - The deployment failed");
        return;
    }

    // 2. Try to call userBalances
    try {
        const market = await ethers.getContractAt("PredictionMarketUMA", MARKET_ADDRESS);

        console.log("\n2. Testing Contract Functions:");

        // Try userBalances
        const balance = await market.userBalances(TEST_USER);
        console.log(`   userBalances(${TEST_USER}): ${ethers.formatUnits(balance, 6)} USDC`);

        // Try marketCount
        const count = await market.marketCount();
        console.log(`   marketCount(): ${count}`);

        // Try operators
        const [signer] = await ethers.getSigners();
        const isOperator = await market.operators(signer.address);
        console.log(`   operators(${signer.address}): ${isOperator}`);

        console.log("\n✅ All contract functions are working!");

    } catch (error: any) {
        console.error("\n❌ Contract call failed:", error.message);
        console.log("\n   This could mean:");
        console.log("   - Contract ABI doesn't match deployed bytecode");
        console.log("   - Wrong network configuration");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
