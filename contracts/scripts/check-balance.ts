import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Address:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Balance:", ethers.formatEther(balance), "BNB");

    if (balance === 0n) {
        console.log("\n⚠️ NO BNB! Get testnet BNB from:");
        console.log("   https://testnet.bnbchain.org/faucet-smart");
    }
}

main().catch(console.error);
