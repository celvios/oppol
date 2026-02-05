
const { ethers } = require("ethers");

const RPC_URL = "https://bnb-mainnet.g.alchemy.com/v2/h-5qlQX9RO0hC3wSSoCix";
const MARKET_ADDRESS = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
const MARKET_ID = 8;

const ABI = [
    "function getMarketBasicInfo(uint256) view returns (string question, string image, string description, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(MARKET_ADDRESS, ABI, provider);

    console.log(`Checking Market ${MARKET_ID} on ${MARKET_ADDRESS}...`);

    try {
        const info = await contract.getMarketBasicInfo(MARKET_ID);
        const now = Math.floor(Date.now() / 1000);

        console.log("--- Market Data ---");
        console.log("Question:", info.question);
        console.log("Resolved:", info.resolved);
        console.log("EndTime (unix):", info.endTime.toString());
        console.log("EndTime (local):", new Date(Number(info.endTime) * 1000).toLocaleString());
        console.log("CurrentTime (unix):", now);
        console.log("Is Ended:", now > Number(info.endTime));
        console.log("Time Remaining:", (Number(info.endTime) - now) / 86400, "days");

    } catch (e) {
        console.error("Error:", e);
    }
}

main();
