import { ethers } from "hardhat";

async function main() {
    console.log("Creating 5 Prediction Markets on PredictionMarketUMA...\n");

    // New deployment addresses
    const MARKET_ADDRESS = "0x797aBDb1BE8A0D5e3d922D014B9525c07A3F0749";
    const USDC_ADDRESS = "0x797aBDb1BE8A0D5e3d922D014B9525c07A3F0749"; // MockUSDC from same deployment

    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    // Get the MockUSDC contract - try to mint some tokens first
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();
    const usdcAddress = await usdc.getAddress();
    console.log("Fresh MockUSDC deployed:", usdcAddress);

    // Deploy a fresh market with this USDC
    const UMA_ORACLE = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd";
    const Market = await ethers.getContractFactory("PredictionMarketUMA");
    const market = await Market.deploy(usdcAddress, UMA_ORACLE);
    await market.waitForDeployment();
    const marketAddress = await market.getAddress();
    console.log("Fresh PredictionMarketUMA deployed:", marketAddress);

    // Set assertion bond to $100
    await market.setAssertionBond(ethers.parseUnits("100", 6));
    console.log("Assertion bond set to $100 USDC\n");

    // Check deployer balance and mint more if needed
    let balance = await usdc.balanceOf(deployer.address);
    console.log(`USDC balance: ${ethers.formatUnits(balance, 6)}`);

    // Mint 100,000 USDC for markets
    await usdc.mint(deployer.address, ethers.parseUnits("100000", 6));
    balance = await usdc.balanceOf(deployer.address);
    console.log(`After mint: ${ethers.formatUnits(balance, 6)}\n`);

    // 3 months = 90 days in seconds
    const THREE_MONTHS = 90 * 24 * 60 * 60;
    // 30 minutes in seconds
    const THIRTY_MINUTES = 30 * 60;

    const markets = [
        // 3 markets ending in 3 months
        {
            question: "Will Bitcoin reach $150,000 by April 2026?",
            duration: THREE_MONTHS,
            liquidity: 2000,
            subsidy: 1000
        },
        {
            question: "Will Ethereum 2.0 staking reach 50M ETH by Q2 2026?",
            duration: THREE_MONTHS,
            liquidity: 1500,
            subsidy: 800
        },
        {
            question: "Will Apple release AR glasses in 2026?",
            duration: THREE_MONTHS,
            liquidity: 1800,
            subsidy: 900
        },
        // 2 markets ending in 30 minutes (for testing assertions)
        {
            question: "TEST: Will this market resolve YES? (30 min)",
            duration: THIRTY_MINUTES,
            liquidity: 500,
            subsidy: 200
        },
        {
            question: "TEST: Quick market for assertion testing (30 min)",
            duration: THIRTY_MINUTES,
            liquidity: 500,
            subsidy: 200
        }
    ];

    console.log(`Creating ${markets.length} markets...\n`);

    for (let i = 0; i < markets.length; i++) {
        const m = markets[i];

        try {
            const subsidyAmount = ethers.parseUnits(m.subsidy.toString(), 6);
            const liquidityParam = ethers.parseUnits(m.liquidity.toString(), 6);

            await usdc.approve(marketAddress, subsidyAmount);

            const tx = await market.createMarket(
                m.question,
                m.duration,
                liquidityParam,
                subsidyAmount
            );
            await tx.wait();

            const price = await market.getPrice(i);
            const endTime = new Date(Date.now() + m.duration * 1000);

            console.log(`✅ Market ${i}: ${m.question}`);
            console.log(`   Price: ${Number(price) / 100}% YES`);
            console.log(`   Ends: ${endTime.toLocaleString()}\n`);
        } catch (error: any) {
            console.log(`❌ Failed Market ${i}: ${error.message.substring(0, 100)}\n`);
        }
    }

    const finalCount = await market.marketCount();
    console.log(`\n✨ Complete! Total markets: ${finalCount}`);
    console.log(`\n📝 UPDATE contracts.ts with:`);
    console.log(`   predictionMarket: '${marketAddress}'`);
    console.log(`   mockUSDC: '${usdcAddress}'`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
