import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("=== Wallet Balances ===\n");
    console.log("Address:", deployer.address);

    // BNB balance
    const bnbBalance = await ethers.provider.getBalance(deployer.address);
    console.log("BNB:", ethers.formatEther(bnbBalance));

    // MockUSDC balance
    try {
        const usdc = await ethers.getContractAt("MockUSDC", "0x4D5988a2660F7eaffd2113E2268e90bc1f186523");
        const usdcBalance = await usdc.balanceOf(deployer.address);
        console.log("MockUSDC:", ethers.formatUnits(usdcBalance, 6));
    } catch (e: any) {
        console.log("MockUSDC: Error -", e.message.substring(0, 50));
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
