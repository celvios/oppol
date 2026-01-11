import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Checking for:", deployer.address);

    const MARKET_ADDRESS = "0x0d0279825957d13c74E6C187Cc37D502E0c3D168";
    const USDC_ADDRESS = "0x792D979781F0E53A51D0cD837cd03827fA8d83A1";

    const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);
    
    const balance = await usdc.balanceOf(deployer.address);
    const allowance = await usdc.allowance(deployer.address, MARKET_ADDRESS);
    
    console.log("USDC Balance:", ethers.formatUnits(balance, 6));
    console.log("Allowance for Market:", ethers.formatUnits(allowance, 6));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
