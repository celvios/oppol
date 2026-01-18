
import { ethers } from "hardhat";

async function main() {
    const marketAddress = process.env.MARKET_CONTRACT;
    const OPOLL_TOKEN = "0x..."; // USER MUST REPLACE THIS
    const MIN_BALANCE = ethers.parseEther("1000"); // 1000 Tokens required
    const PUBLIC_CREATION = false; // Restricted to token holders

    if (!marketAddress) {
        throw new Error("Missing MARKET_CONTRACT in env");
    }

    console.log("🔒 Configuring Token Gating for:", marketAddress);
    console.log("   Token:", OPOLL_TOKEN);
    console.log("   Min Balance:", ethers.formatEther(MIN_BALANCE));

    const Market = await ethers.getContractFactory("PredictionMarketMultiV2");
    const market = Market.attach(marketAddress);

    const tx = await market.setCreationSettings(OPOLL_TOKEN, MIN_BALANCE, PUBLIC_CREATION); // Type error fix: function exists in solidity but typings might be stale if not compiled.
    // Note: if types are not generated, you might need to use raw transaction or ensure compilation.

    console.log("   Tx sent:", tx.hash);
    await tx.wait();
    console.log("✅ Token Gating Configured!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
