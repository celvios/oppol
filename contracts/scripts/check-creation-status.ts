import { ethers } from "hardhat";

async function main() {
    const MARKET_ADDRESS = "0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6";
    const [deployer] = await ethers.getSigners();

    console.log("Checking creation status for:", deployer.address);
    const market = await ethers.getContractAt("PredictionMarketMulti", MARKET_ADDRESS);

    try {
        const publicCreation = await market.publicCreation();
        console.log("Public Creation Enabled:", publicCreation);

        const creationToken = await market.creationToken();
        console.log("Creation Token:", creationToken);

        const minBalance = await market.minCreationBalance();
        console.log("Min Balance Required:", ethers.formatUnits(minBalance, 18));

        if (creationToken !== ethers.ZeroAddress) {
            const token = await ethers.getContractAt("IERC20", creationToken);
            const balance = await token.balanceOf(deployer.address);
            console.log("Deployer Token Balance:", ethers.formatUnits(balance, 18));
        }

        // Also check if deployer is an operator (if that helps?)
        // operators mapping is public
        const isOperator = await market.operators(deployer.address);
        console.log("Is Operator:", isOperator);

    } catch (error: any) {
        console.error("Error fetching status:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
