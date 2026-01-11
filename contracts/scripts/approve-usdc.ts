import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    
    const MARKET_ADDRESS = "0x0d0279825957d13c74E6C187Cc37D502E0c3D168";
    const USDC_ADDRESS = "0x792D979781F0E53A51D0cD837cd03827fA8d83A1";
    
    const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);
    
    console.log("Approving 10,000 USDC...");
    const tx = await usdc.approve(MARKET_ADDRESS, ethers.parseUnits("10000", 6));
    await tx.wait();
    console.log("✅ Approved!");
    
    const allowance = await usdc.allowance(deployer.address, MARKET_ADDRESS);
    console.log("New allowance:", ethers.formatUnits(allowance, 6));
}

main().catch(console.error);
