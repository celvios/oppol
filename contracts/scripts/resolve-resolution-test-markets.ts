import { ethers } from "hardhat";

async function main() {
    console.log("⚖️ Resolving Test Markets...\n");

    const MARKET_ADDRESS = "0x57f3E8D7543ba4008708B80116aB7FAcc7D265e5";
    const ORACLE_ADDRESS = "0x930D7cebd451B334f9DdF3d89deC931CFf588195";

    const [deployer] = await ethers.getSigners();
    const market = await ethers.getContractAt("PredictionMarketUMA", MARKET_ADDRESS);
    const oracle = await ethers.getContractAt("MockOracle", ORACLE_ADDRESS);

    // IDs of the 5 markets we created (Assuming they are the last 5, or specifically 0-4 if fresh deploy)
    // We'll target the IDs from the creation script: 0, 1, 2, 3, 4
    // (Adjust these if your market count was higher)
    const marketIds = [0, 1, 2, 3, 4];
    const outcomes = [true, true, true, false, false]; // Arbitrary test outcomes

    for (let i = 0; i < marketIds.length; i++) {
        const id = marketIds[i];
        const outcome = outcomes[i];

        console.log(`Processing Market ${id}...`);

        try {
            // 1. Assert Outcome (Oracle)
            // In UMA, anyone asserts. In our mock, we call assertTruth directly on Oracle or Market?
            // Market calls oracle.assertTruth.
            // Wait, PredictionMarketUMA.resolveMarket calls oracle.assertTruth?
            // Let's check PredictionMarketUMA.sol logic briefly. 
            // Usually: 
            // - assertOutcome(marketId, outcome) -> calls oracle.assertTruth
            // - wait liveness
            // - settleOutcome(marketId) -> calls oracle.settle

            console.log(`  Asserting ${outcome ? "YES" : "NO"}...`);
            const assertTx = await market.assertOutcome(id, outcome);
            await assertTx.wait();

            console.log(`  Settling (Mocking time pass)...`);
            // In MockOracle, settleAssertion doesn't check time, just settles.
            // We need to call market.settleOutcome(id).
            const settleTx = await market.settleOutcome(id);
            await settleTx.wait();

            console.log(`  ✅ Market ${id} Resolved to ${outcome ? "YES" : "NO"}\n`);

        } catch (error: any) {
            console.log(`  ⚠️ Failed/Already Resolved: ${error.message.substring(0, 100)}\n`);
        }
    }

    console.log("🎉 Resolution Script Complete!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
