import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
const MARKET_ADDR = process.env.MARKET_CONTRACT || '0xB6a211822649a61163b94cf46e6fCE46119D3E1b';

const marketABI = [
    'function marketCount() view returns (uint256)',
    'function markets(uint256) view returns (string question, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome, uint256 subsidyPool, bytes32 assertionId, bool assertionPending, address asserter, uint256 assertedOutcome)',
    'function getAllPrices(uint256 marketId) view returns (uint256[])',
    'function getMarketOutcomes(uint256 marketId) view returns (string[])'
];

async function main() {
    console.log(`Connecting to ${RPC_URL}`);
    console.log(`Contract: ${MARKET_ADDR}`);

    const provider = new ethers.JsonRpcProvider(RPC_URL, 97);
    const contract = new ethers.Contract(MARKET_ADDR, marketABI, provider);

    try {
        console.log("Calling marketCount()...");
        const count = await contract.marketCount();
        console.log(`Count: ${count}`);

        if (count > 0) {
            console.log("Calling markets(0)...");
            const m = await contract.markets(0);
            console.log("Market 0:", m);

            console.log("Calling getAllPrices(0)...");
            const prices = await contract.getAllPrices(0);
            console.log("Prices:", prices);

            console.log("Calling getMarketOutcomes(0)...");
            const outcomes = await contract.getMarketOutcomes(0);
            console.log("Outcomes:", outcomes);
        }
    } catch (error: any) {
        console.error("ERROR:", error.reason || error.message || error);
        if (error.data) console.error("Data:", error.data);
    }
}

main();
