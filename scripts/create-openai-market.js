const { ethers } = require('ethers');
require('dotenv').config();

const MARKET_ADDRESS = process.env.MARKET_CONTRACT || '0xe5a5320b3764Bd8FFFd95cF7aA7F406DaC2B070C';
const RPC_URL = 'https://rpc.ankr.com/bsc/8696831c7e5da7cc66fb967d8f86b97ff978d69ebbf902a0ac5785375df17fc8';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0xdbe5dc7428a337f186f76ca878b95f83dcc17392aadbd33950cfa1b32574209c';

// V3/V4 ABI expects duration in minutes, not explicit endTime and liquidity
const MARKET_ABI = [
    "function createMarket(string memory _question, string memory _description, string memory _image, string[] memory _outcomeNames, uint256 _durationMinutes) external returns (uint256)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log("Admin Wallet:", wallet.address);
    console.log("Market Contract:", MARKET_ADDRESS);

    const contract = new ethers.Contract(MARKET_ADDRESS, MARKET_ABI, wallet);

    const question = "Will OpenAI announce Sora 2.0 or GPT-5 by March 2026?";
    const description = "Predict if OpenAI makes an official announcement for either Sora 2.0 or the GPT-5 model before the start of March 2026 (7 days from now).";
    const image = "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/ChatGPT_logo.svg/1024px-ChatGPT_logo.svg.png";
    const outcomes = ["Yes", "No"];

    // 7 days = 7 * 24 * 60 = 10080 minutes
    const durationMinutes = 10080;

    try {
        console.log("Estimating gas for V4 createMarket...");
        const gasLimit = await contract.createMarket.estimateGas(question, description, image, outcomes, durationMinutes);
        console.log("Gas Limit:", gasLimit.toString());

        const tx = await contract.createMarket(question, description, image, outcomes, durationMinutes, {
            gasLimit: gasLimit + 100000n
        });
        console.log("Transaction sent! Hash:", tx.hash);

        const receipt = await tx.wait();
        console.log("Market created successfully in block", receipt.blockNumber);
    } catch (e) {
        console.error("FAILED REASON:", JSON.stringify(e, null, 2));
    }
}

main().catch(console.error);
