
const { ethers } = require('ethers');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const MARKET_ID = 4;
const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc.publicnode.com';
const MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";

const ABI = [
    "function getMarketBasicInfo(uint256 marketId) view returns (string question, string image, string description, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)",
    "function getPrice(uint256 marketId, uint256 outcomeIndex) public view returns (uint256)",
    "function getMarketShares(uint256 marketId) view returns (uint256[])",
    "function markets(uint256) public view returns (string, string, address, uint256, bool, bool)", // minimal approximate
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const market = new ethers.Contract(MARKET_ADDR, ABI, provider);

    console.log(`Checking Market ${MARKET_ID}...`);

    try {
        // Get Prices
        const pYes = await market.getPrice(MARKET_ID, 0);
        const pNo = await market.getPrice(MARKET_ID, 1);

        // Get Outcome Shares (Tracking volume/popularity)
        const sharesArray = await market.getMarketShares(MARKET_ID);
        const sYes = sharesArray[0];
        const sNo = sharesArray[1];

        // Get Basic Info
        const info = await market.getMarketBasicInfo(MARKET_ID);
        // info: [question, image, desc, outcomeCount, endTime, liquidityParam, ...]

        let initialLiq = info[5];

        // Log to file
        let fullLog = `Question: ${info[0]}\n`;
        fullLog += `End Time: ${info[4]} (${new Date(Number(info[4]) * 1000).toISOString()})\n`;
        fullLog += `Initial Liquidity: ${ethers.formatUnits(initialLiq, 18)}\n`;
        fullLog += `YES Price: ${pYes} (${(Number(pYes) / 100).toFixed(2)}%)\n`;
        fullLog += `NO Price: ${pNo} (${(Number(pNo) / 100).toFixed(2)}%)\n`;
        fullLog += `YES Shares: ${ethers.formatUnits(sYes, 18)}\n`;
        fullLog += `NO Shares: ${ethers.formatUnits(sNo, 18)}\n`;

        // Calculate Net Volume?
        // If shares > 0, people bought shares.
        // Assuming V2, shares represent user holdings?
        // Wait, V2 `market.shares` tracks outstanding shares.
        // Liquidity is separate.
        // Cost = f(shares, liquidity).
        // Total Volume ~ Cost of all trades.

        fs.writeFileSync('market_4_status.txt', fullLog);
        console.log("Written full status to market_4_status.txt");
        console.log(fullLog);

    } catch (e) {
        console.error("Error fetching market data:", e);
        fs.writeFileSync('market_4_status.txt', `Error: ${e.message}`);
    }
}

main().catch(console.error);
