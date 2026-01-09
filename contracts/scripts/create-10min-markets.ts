import { ethers } from "hardhat";

async function main() {
    // New deployed market address
    const MARKET_ADDRESS = "0x315640C6eb0635B0A7717b8345b0FB4c2a10157D";

    const [deployer] = await ethers.getSigners();
    console.log("Creating markets with account:", deployer.address);

    const market = await ethers.getContractAt("PredictionMarketUMA", MARKET_ADDRESS);

    const DURATION = 10 * 60; // 10 minutes in seconds
    const LIQUIDITY = ethers.parseEther("1000");

    const questions = [
        "Will BTC reach $100k by end of Q1 2026?",
        "Will ETH flip BNB in daily volume today?",
        "Will the next Fed meeting cut rates?",
        "Will Messi score in his next match?",
        "Will it rain in Lagos tomorrow?"
    ];

    console.log("\n🚀 Creating 5 markets (10 minute expiry)...\n");

    for (let i = 0; i < questions.length; i++) {
        console.log(`Creating market ${i + 1}: "${questions[i]}"`);
        const tx = await market.createMarket(questions[i], DURATION, LIQUIDITY, 0);
        await tx.wait();
        console.log(`✅ Market ${i} created`);
    }

    console.log("\n🎉 All 5 markets created!");
    console.log("Markets will expire in 10 minutes from creation time.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
