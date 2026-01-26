const { ethers } = require("ethers");
require("dotenv").config();

const RPCS = [
    "https://bsc-dataseed1.defibit.io/",
    "https://bsc-dataseed.binance.org/",
    "https://bsc-rpc.publicnode.com"
];

const CONTRACT_A = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B"; // Admin/Zap
const CONTRACT_B = "0xA7DEd30e8A292dAA8e75A8d288393f8e290f9717"; // Frontend

const ABI = ["function marketCount() view returns (uint256)"];

async function main() {
    console.log("Comparing Contracts...");
    let provider;
    for (const rpc of RPCS) {
        try { provider = new ethers.JsonRpcProvider(rpc); await provider.getNetwork(); break; } catch (e) { }
    }

    const ca = new ethers.Contract(CONTRACT_A, ABI, provider);
    const cb = new ethers.Contract(CONTRACT_B, ABI, provider);

    try {
        const countA = await ca.marketCount();
        console.log(`Contract A (Zap/Admin) [${CONTRACT_A}] Market Count: ${countA}`);
    } catch (e) {
        console.log(`Contract A Error: ${e.message}`);
    }

    try {
        const countB = await cb.marketCount();
        console.log(`Contract B (Frontend)   [${CONTRACT_B}] Market Count: ${countB}`);
    } catch (e) {
        console.log(`Contract B Error: ${e.message}`);
    }
}

main().catch(console.error);
