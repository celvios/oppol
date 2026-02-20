
const { ethers } = require('ethers');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const MARKET_ID = 4;
const USER_ADDRESS = '0xD5EeB48921F15Cdc0863fAA841fc08F998b9e55f';
const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org/';
const MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";

const ABI = [
    "function getUserPosition(uint256 marketId, address user) view returns (uint256[] shares, bool claimed)",
    "function userBalances(address) view returns (uint256)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const market = new ethers.Contract(MARKET_ADDR, ABI, provider);

    console.log(`Checking Payout for ${USER_ADDRESS} on Market ${MARKET_ID}...`);

    try {
        const position = await market.getUserPosition(MARKET_ID, USER_ADDRESS);
        const sharesArray = position[0]; // uint256[] shares

        // Outcome 0: YES, Outcome 1: NO
        const sharesYes = ethers.formatUnits(sharesArray[0], 18);
        const sharesNo = ethers.formatUnits(sharesArray[1], 18);

        console.log(`\nYour Holdings:`);
        console.log(`YES Shares: ${sharesYes}`);
        console.log(`NO Shares:  ${sharesNo}`);

        const winningAmount = parseFloat(sharesNo);
        // Assuming 1 Share = 1 USDC payout if it wins (Standard Binary Market)
        console.log(`\nPotential Winnings if NO wins:`);
        console.log(`$${winningAmount.toFixed(4)} USDC`);

        // Check Internal Funds
        const internalBal = await market.userBalances(USER_ADDRESS);
        console.log(`\nUnused Internal Funds:`);
        console.log(`$${ethers.formatUnits(internalBal, 18)} USDC`);

    } catch (e) {
        console.error("Error fetching position:", e);
    }
}

main().catch(console.error);
