import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // Use your existing USDC token address
  const USDC_ADDRESS = "0x792D979781F0E53A51D0cD837cd03827fA8d83A1";

  const PredictionMarketV2 = await ethers.getContractFactory("PredictionMarketV2");
  const market = await PredictionMarketV2.deploy(USDC_ADDRESS);
  await market.waitForDeployment();

  const address = await market.getAddress();
  console.log("PredictionMarketV2 deployed to:", address);
  console.log("USDC Token:", USDC_ADDRESS);
  console.log("Deployer set as operator:", deployer.address);

  return { market: address, usdc: USDC_ADDRESS };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
