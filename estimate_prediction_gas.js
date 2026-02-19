
const { ethers } = require("ethers");
const fs = require("fs");

// Load artifact
const artifactPath = "contracts/artifacts/contracts/PredictionMarketMultiV2.sol/PredictionMarketMultiV2.json";
// Note: Using V2 artifact as betController uses MARKET_CONTRACT (V2 address typically)
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const abi = artifact.abi;

// Address from betController.ts or .env
const MARKET_ADDRESS = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
const RPC_URL = "https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/";

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // We need a wallet to estimate gas for a transaction that requires funds/allowance
    // BUT we don't have the private key easily available in this script without installing dotenv.
    // Let's try to simulate a call from a random address, or use provider.call?
    // estimateGas usually needs a valid sender with funds if the contract checks balance.
    // buyShares checks USDC balance. 
    // So simple estimateGas will revert with "Insufficient Balance".

    // However, we can roughly estimate based on similar transactions or complex logic.
    // A standard buyShares involves:
    // 1. Storage update (shares)
    // 2. Storage update (user position)
    // 3. Storage update (accumulatedFees)
    // 4. ERC20 Transfer (USDC)

    // This looks like ~150,000 - 250,000 gas.

    // Let's just output the theoretical calculation based on standard opcode costs for now
    // because simulating without a funded account + USDC approval is hard in a script.

    console.log("Estimating Prediction Gas Cost (Theoretical)...");

    const estimatedGas = 200000; // Conservative average for complex state update + transfer
    console.log(`Estimated Gas Units: ~${estimatedGas}`);

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice; // 0.05 gwei currently

    console.log(`Current Gas Price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);

    // Scenarios
    const prices = [
        { name: "Current (Low)", price: gasPrice },
        { name: "Standard", price: ethers.parseUnits("3", "gwei") },
        { name: "High", price: ethers.parseUnits("10", "gwei") }
    ];

    for (const p of prices) {
        const costWei = BigInt(estimatedGas) * p.price;
        const costBNB = ethers.formatEther(costWei);
        const costUSD = parseFloat(costBNB) * 600;
        console.log(`[${p.name} - ${ethers.formatUnits(p.price, "gwei")} gwei]: ${costBNB} BNB (~$${costUSD.toFixed(4)})`);
    }

}

main().catch(console.error);
