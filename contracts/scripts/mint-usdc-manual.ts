import { ethers } from "hardhat";

async function main() {
    const USDC_ADDRESS = "0x792D979781F0E53A51D0cD837cd03827fA8d83A1";
    const TARGET_ADDRESS = "0xe5a96d0237e12ef8c20f91acf26136a9cf73db81";

    // Check decimals (usually 18 for basic ERC20 mocks unless specified)
    // Looking at check-state.ts it was treated as 6 decimals.
    // If MockUSDC inherits ERC20 directly it defaults to 18 unless overridden.
    // I will check the file content first, but for now assuming 6 to match previous context.
    // Update: If view_file shows 18, I will update this script.
    const AMOUNT = ethers.parseUnits("500000", 6);

    const [signer] = await ethers.getSigners();
    console.log("Minting with signer:", signer.address);

    const usdc = await ethers.getContractAt("MockUSDC", USDC_ADDRESS);

    console.log(`Minting 500,000 USDC to ${TARGET_ADDRESS}...`);
    try {
        const tx = await usdc.mint(TARGET_ADDRESS, AMOUNT);
        await tx.wait();
        console.log("✅ Mint successful!");
    } catch (e) {
        console.error("Mint failed:", e);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
