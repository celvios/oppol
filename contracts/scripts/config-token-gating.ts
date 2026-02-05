
import { ethers } from "hardhat";

async function main() {
    const marketAddress = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    const OPOLL_TOKEN = "0xB929177331De755d7aCc5665267a247e458bCdeC";
    const MIN_BALANCE = 1; // 1 Token/NFT required
    const PUBLIC_CREATION = false; // Restricted to token holders

    console.log("🔒 Configuring Token Gating for:", marketAddress);
    console.log("   Token:", OPOLL_TOKEN);
    console.log("   Min Balance:", MIN_BALANCE);

    const Market = await ethers.getContractFactory("PredictionMarketMultiV2");
    const market = Market.attach(marketAddress);

    // Manual interface if types are missing
    // function setCreationSettings(address _token, uint256 _minBalance, bool _public) external onlyOwner
    const tx = await market.setCreationSettings(OPOLL_TOKEN, MIN_BALANCE, PUBLIC_CREATION);
    // Note: if types are not generated, you might need to use raw transaction or ensure compilation.

    console.log("   Tx sent:", tx.hash);
    await tx.wait();
    console.log("✅ Token Gating Configured!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
