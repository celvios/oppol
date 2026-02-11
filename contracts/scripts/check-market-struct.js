const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    const PROXY = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    const ABI = [
        "function markets(uint256) view returns (string question, string image, string description, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, uint256 subsidyPool, bool resolved, uint256 winningOutcome, bool assertionPending, uint256 assertedOutcome, address asserter)",
        "function getAllPrices(uint256 marketId) view returns (uint256[])"
    ];

    const contract = new ethers.Contract(PROXY, ABI, ethers.provider);

    console.log("Checking Market 4 On-Chain...");
    try {
        const m = await contract.markets(4);
        let output = `Liquidity Param (Raw): ${m.liquidityParam.toString()}\n`;
        output += `Liquidity Param (6 full): ${ethers.formatUnits(m.liquidityParam, 6)}\n`;
        output += `Liquidity Param (18 full): ${ethers.formatUnits(m.liquidityParam, 18)}\n`;

        const prices = await contract.getAllPrices(4);
        output += `Prices: ${prices.map(p => p.toString()).join(", ")}\n`;

        fs.writeFileSync("C:/Users/toluk/Documents/oppol/liquidity_check.txt", output);
        console.log("Output written to liquidity_check.txt");
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
