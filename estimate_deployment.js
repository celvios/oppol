
const { ethers } = require("ethers");
const fs = require("fs");

// Load artifact
const artifactPath = "contracts/artifacts/contracts/PredictionMarketMultiV3.sol/PredictionMarketMultiV3.json";
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const bytecode = artifact.bytecode;

const RPC_URL = "https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/";

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Get current gas price
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice;

    console.log("Analyzing Deployment Cost...");
    console.log(`Current Gas Price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);

    // Estimate gas for deployment
    try {
        const gasEstimate = await provider.estimateGas({
            data: bytecode
        });

        console.log(`Estimated Gas Units: ${gasEstimate.toString()}`);

        const costWei = gasEstimate * gasPrice;
        const costBNB = ethers.formatEther(costWei);

        console.log(`Estimated Cost: ${costBNB} BNB`);

        // Calculate USD cost (assuming BNB = $600)
        const bnbPrice = 600;
        const costUSD = parseFloat(costBNB) * bnbPrice;
        console.log(`Estimated Cost in USD (at $600/BNB): $${costUSD.toFixed(2)}`);

    } catch (e) {
        console.error("Estimation failed:", e);
    }
}

main().catch(console.error);
