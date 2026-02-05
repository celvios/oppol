import { ethers } from "hardhat";

async function main() {
    const marketAddress = process.env.NEXT_PUBLIC_MARKET_ADDRESS || "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";

    if (!marketAddress) {
        throw new Error("Market Address not found"); // Should not happen with fallback
    }

    console.log(`Connecting to market at ${marketAddress}...`);

    // Get the deployer (signer)
    const [deployer] = await ethers.getSigners();
    console.log(` interacting as deployer: ${deployer.address}`);

    // Get the contract instance
    const PredictionMarket = await ethers.getContractFactory("PredictionMarketMultiV2");
    const market = PredictionMarket.attach(marketAddress);

    // Determine the operator address
    // Priority: OPERATOR_ADDRESS env var -> same as deployer
    let operatorAddress = process.env.OPERATOR_ADDRESS;

    if (!operatorAddress) {
        console.log("No OPERATOR_ADDRESS set, using deployer address as operator...");
        operatorAddress = deployer.address;
    }

    console.log(`Whitelisting operator: ${operatorAddress}`);

    // Check if already an operator
    const isOperator = await market.operators(operatorAddress);
    if (isOperator) {
        console.log(`Address ${operatorAddress} is already an operator.`);
        return;
    }

    // Set operator
    const tx = await market.setOperator(operatorAddress, true);
    console.log(`Transaction sent: ${tx.hash}`);

    await tx.wait();
    console.log(`Successfully set ${operatorAddress} as operator.`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
