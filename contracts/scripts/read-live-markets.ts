
import { ethers } from "ethers";
import * as dotenv from "dotenv";

const RPC_URL = 'https://bsc-testnet-rpc.publicnode.com';
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
    console.log(`Markets Counter: ${count}`);

    for (let i = Math.max(0, Number(count) - 5); i < Number(count); i++) {
        try {
            const info = await contract.getMarketBasicInfo(i);
            const question = info[0];
            const outcomes = await contract.getMarketOutcomes(i);
            const prices = await contract.getAllPrices(i);

            console.log(`\n--- Market #${i} ---`);
            console.log(`Q: ${question}`);
            console.log(`Liquidity: ${info[3]}`);

            outcomes.forEach((name: string, idx: number) => {
                const price = Number(prices[idx]) / 100;
                console.log(`  [${name}]: ${price}%`);
            });
        } catch (e) {
            console.log(`Error reading market ${i}:`, e);
        }
    }
}

main();
