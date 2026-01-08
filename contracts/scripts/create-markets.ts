import { ethers } from "hardhat";

async function main() {
    console.log("Creating 5 Real Prediction Markets...\n");

    const MARKET_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
    const USDC_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

    const [deployer] = await ethers.getSigners();

    const market = await ethers.getContractAt("PredictionMarketLMSR", MARKET_ADDRESS);
    const usdc = await ethers.getContractAt("MockUSDC", USDC_ADDRESS);

    const balance = await usdc.balanceOf(deployer.address);
    console.log(`USDC balance: ${ethers.formatUnits(balance, 6)}\n`);

    const markets = [
        { question: "Will Bitcoin reach $100,000 by end of 2026?", duration: 365 * 24 * 60 * 60, liquidity: 1000, subsidy: 1000 },
        { question: "Will Ethereum ETF be approved in Q1 2026?", duration: 90 * 24 * 60 * 60, liquidity: 800, subsidy: 800 },
        { question: "Will Fed cut interest rates in next 6 months?", duration: 180 * 24 * 60 * 60, liquidity: 1200, subsidy: 1200 },
        { question: "Will Trump win 2024 US Presidential Election?", duration: 300 * 24 * 60 * 60, liquidity: 2000, subsidy: 2000 },
        { question: "Will AI replace 10% of jobs by 2027?", duration: 730 * 24 * 60 * 60, liquidity: 1500, subsidy: 1500 }
    ];

    const startCount = await market.marketCount();
    console.log(`Creating ${markets.length} markets (starting from ID ${startCount})...\n`);

    for (let i = 0; i < markets.length; i++) {
        const m = markets[i];

        try {
            const subsidyAmount = ethers.parseUnits(m.subsidy.toString(), 6);
            await usdc.approve(MARKET_ADDRESS, subsidyAmount);

            const tx = await market.createMarket(m.question, m.duration, ethers.parseUnits(m.liquidity.toString(), 6), subsidyAmount);
            await tx.wait();

            const newMarketId = Number(startCount) + i;
            const price = await market.getPrice(newMarketId);

            console.log(`Market ${newMarketId}: ${m.question}`);
            console.log(`  Price: ${Number(price) / 100}% YES | Liquidity: $${m.liquidity}\n`);
        } catch (error: any) {
            console.log(`Failed: ${error.message.substring(0, 80)}\n`);
        }
    }

    const finalCount = await market.marketCount();
    console.log(`Complete! Total markets: ${finalCount}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
