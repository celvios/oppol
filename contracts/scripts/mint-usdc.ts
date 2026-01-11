import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    
    const USDC_ADDRESS = "0x64544969ed7EBf5f083679233325356EbE738930";
    const usdc = await ethers.getContractAt("MockUSDC", USDC_ADDRESS);
    
    console.log("Minting 80,000 USDC to:", deployer.address);
    const tx = await usdc.mint(deployer.address, ethers.parseUnits("80000", 6));
    await tx.wait();
    console.log("✅ Minted!");
}

main().catch(console.error);
