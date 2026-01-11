import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Depositing with:", deployer.address);

    const MARKET_ADDRESS = "0x58c957342B8cABB9bE745BeBc09C267b70137959";
    const USDC_ADDRESS = "0x64544969ed7EBf5f083679233325356EbE738930";
    const AMOUNT = "80000"; // 80k USDC

    const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);
    const market = await ethers.getContractAt("PredictionMarketV2", MARKET_ADDRESS);

    const amountInUnits = ethers.parseUnits(AMOUNT, 6);

    console.log(`Approving ${AMOUNT} USDC...`);
    const approveTx = await usdc.approve(MARKET_ADDRESS, amountInUnits);
    await approveTx.wait();
    console.log("✅ Approved");

    console.log(`Depositing ${AMOUNT} USDC...`);
    const depositTx = await market.deposit(amountInUnits);
    await depositTx.wait();
    console.log("✅ Deposited");

    const balance = await market.userBalances(deployer.address);
    console.log(`New balance: ${ethers.formatUnits(balance, 6)} USDC`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
