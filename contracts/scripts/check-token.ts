import { ethers } from "hardhat";

async function main() {
    const marketAddress = "0x4b7951815a303aD59733A3c775AcF37d54be948f";
    const market = await ethers.getContractAt("PredictionMarketUMA", marketAddress);
    const token = await market.token();
    console.log("Token Address:", token);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
