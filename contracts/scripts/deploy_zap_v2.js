const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    const MARKET_ADDR = "0xA7DEd30e8A292dAA8e75A8d288393f8e290f9717"; // Correct Market (Contract B)
    const USDC_ADDR = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"; // BSC Mainnet USDC
    const ROUTER_ADDR = "0x10ED43C718714eb63d5aA57B78B54704E256024E"; // PancakeSwap V2 Router

    console.log("🚀 Deploying Zap V2...");
    console.log("Market:", MARKET_ADDR);

    const ZapFactory = await ethers.getContractFactory("Zap");
    const zap = await ZapFactory.deploy(MARKET_ADDR, USDC_ADDR, ROUTER_ADDR);

    await zap.waitForDeployment();
    const addr = await zap.getAddress();
    console.log(addr);
    require("fs").writeFileSync("address.txt", addr);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
