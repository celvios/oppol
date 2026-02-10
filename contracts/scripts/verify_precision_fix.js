const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("Starting verification...");

    // Deploy Mock Token
    const Token = await ethers.getContractFactory("MockERC20");
    const token = await Token.deploy("Test Token", "TEST");
    await token.waitForDeployment();
    const tokenAddr = await token.getAddress();
    console.log("Token deployed to:", tokenAddr);

    // Deploy Market Contract
    const Market = await ethers.getContractFactory("PredictionMarketMultiV3");
    const market = await upgrades.deployProxy(Market, [tokenAddr, tokenAddr], { initializer: "initialize" });
    await market.waitForDeployment();
    const marketAddr = await market.getAddress();
    console.log("Market deployed to:", marketAddr);

    // Setup user
    const [owner, user] = await ethers.getSigners();

    // Mint tokens to user
    await token.mint(user.address, ethers.parseUnits("1000", 18));
    await token.connect(user).approve(marketAddr, ethers.parseUnits("1000", 18));

    // DEPOSIT TO MARKET (Critical step missed!)
    console.log("Depositing tokens...");
    await market.connect(user).deposit(ethers.parseUnits("500", 18)); // Deposit 500 tokens

    // Create Market
    console.log("\nCreating market...");
    const outcomes = ["Yes", "No"];
    await market.connect(owner).createMarketV3(
        "Will it rain?",
        "image.png",
        "desc",
        outcomes,
        7 // duration
    );

    // CHECK 1: Initial Prices
    console.log("\n--- Checking Initial Prices ---");
    const prices = await market.getAllPrices(0);
    console.log("Price Yes:", Number(prices[0]) / 100, "%");
    console.log("Price No:", Number(prices[1]) / 100, "%");

    if (Number(prices[0]) === 5000 && Number(prices[1]) === 5000) {
        console.log("✅ Initial prices are exactly 50/50");
    } else {
        console.error("❌ Initial prices are NOT 50/50");
    }

    // CHECK 2: Small Purchase Impact ($1)
    console.log("\n--- Buying $1 worth of 'Yes' shares ---");
    // $1 cost + fee. Let's calculate cost for 1 share (which should be small now with fix)

    // Let's buy 1 full share (1e18)
    const sharesToBuy = ethers.parseUnits("1", 18);

    // Calculate cost
    const cost = await market.calculateCost(0, 0, sharesToBuy);
    console.log("Cost for 1 share (in USDC 6 decimals):", ethers.formatUnits(cost, 6)); // Wait, calculateCost returns 18 decimals usually? No, returns unscaled?
    // calculateCost returns whatever the contract returns.
    // In V2, it returns `(costAfter - costBefore) / PRECISION`

    // PRECISION is 1e18.
    // _lmsrCost returns b * lnSum.
    // b is 18 decimals (after scaling).
    // So _lmsrCost returns 18 decimals (conceptually).
    // Actually, check _lmsrCost: b * lnSum.
    // lnSum has PRECISION (1e18) scale.
    // So result is b * 1e18.

    // If b has 18 decimals: result has 36 decimals.
    // calculateCost divides by PRECISION (1e18).
    // So result has 18 decimals.

    // So `cost` IS 18 decimals (Token units).
    // USDC uses 18 decimals in this Mock setup?
    // Wait MockERC20 uses default 18 decimals.

    console.log("Cost for 1 share (in Token units):", ethers.formatEther(cost));

    // Execute buy
    await market.connect(user).buySharesV3(0, 0, sharesToBuy, ethers.parseUnits("1000", 18));

    // Check new prices
    const newPrices = await market.getAllPrices(0);
    console.log("New Price Yes:", Number(newPrices[0]) / 100, "%");
    console.log("New Price No:", Number(newPrices[1]) / 100, "%");

    const priceDiff = (Number(newPrices[0]) - 5000) / 100;
    console.log("Price Impact:", priceDiff.toFixed(5), "%");

    if (priceDiff < 1) {
        console.log("✅ Price impact is reasonable (<1% for 1 share)");
    } else {
        console.error("❌ Price impact is too high!");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
