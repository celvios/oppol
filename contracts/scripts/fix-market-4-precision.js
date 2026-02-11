const { ethers } = require("hardhat");

async function main() {
    const PROXY = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    const ABI = [
        "function fixMarketLiquidity(uint256 marketId, uint256 newLiquidity) external",
        "function markets(uint256) view returns (string, string, string, uint256, uint256, uint256, uint256, bool, uint256, bool, uint256, address)",
        "function getAllPrices(uint256 marketId) view returns (uint256[])"
    ];

    const [signer] = await ethers.getSigners();
    const contract = new ethers.Contract(PROXY, ABI, signer);

    console.log("Fixing Market 4 Liquidity Precision...");

    // CURRENT: 200 * 1e18 (200000000000000000000)
    // TARGET: 200 * 1e6   (200000000)
    // Because contract does: b = liquidityParam * 1e12

    const correctLiquidity = ethers.parseUnits("200", 6); // 200 * 10^6
    console.log(`Setting liquidity to: ${correctLiquidity.toString()}`);

    const tx = await contract.fixMarketLiquidity(4, correctLiquidity);
    console.log(`Tx sent: ${tx.hash}`);
    await tx.wait();
    console.log("Liquidity updated!");

    const m = await contract.markets(4);
    console.log(`New Liquidity Param: ${m[5].toString()}`); // index 5 is liquidityParam

    const prices = await contract.getAllPrices(4);
    console.log(`New Prices: ${prices.map(p => p.toString()).join(", ")}`);
}

main();
