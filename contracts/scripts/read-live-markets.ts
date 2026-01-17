
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as fs from "fs";

dotenv.config();

const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
const MARKET_ADDRESS = '0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6';

const ABI = [
    'function marketCount() view returns (uint256)',
    'function getMarketBasicInfo(uint256) view returns (string, uint256, uint256, uint256, bool, uint256)',
    'function getAllPrices(uint256) view returns (uint256[])',
    'function getMarketOutcomes(uint256) view returns (string[])'
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(MARKET_ADDRESS, ABI, provider);

    const count = await contract.marketCount();
    let output = `Live Market Report (Total: ${count})\n`;
    output += "------------------------------------------------\n";

    for (let i = 0; i < Number(count); i++) {
        try {
            const info = await contract.getMarketBasicInfo(i);
            const question = info[0];
            const outcomes = await contract.getMarketOutcomes(i);
            const prices = await contract.getAllPrices(i);
            const liquidity = info[3]; // liquidity param

            output += `Market ID: ${i}\n`;
            output += `Question: ${question}\n`;

            output += `Odds:\n`;
            outcomes.forEach((name: string, idx: number) => {
                const price = Number(prices[idx]) / 100; // basis points to %
                output += `  - ${name}: ${price}%\n`;
            });
            output += "------------------------------------------------\n";
        } catch (e) {
            output += `Error reading market ${i}: ${e}\n`;
        }
    }

    fs.writeFileSync('all_markets.txt', output);
    console.log("Report generated: all_markets.txt");
}

main();
