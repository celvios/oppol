import { ethers } from "hardhat";

async function main() {
    const marketAddress = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    const market = await ethers.getContractAt("PredictionMarketMulti", marketAddress);

    console.log(`Checking Market 0 at ${marketAddress}...`);

    try {
        const info = await market.getMarketBasicInfo(0);
        console.log("Market 0 Info:", {
            question: info.question,
            outcomeCount: info.outcomeCount.toString(),
            endTime: new Date(Number(info.endTime) * 1000).toLocaleString(),
            resolved: info.resolved,
            winningOutcome: info.winningOutcome.toString()
        });

        const status = await market.getMarketStatus(0);
        console.log("Market 0 Status:", {
            ended: status.ended,
            assertionPending: status.assertionPending,
            resolved: status.resolved,
            winningOutcome: status.winningOutcome.toString()
        });

    } catch (e) {
        console.error("Error fetching market 0:", e);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
