
const ethers = require('ethers');
require('dotenv').config();

const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org';
const MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MULTI_MARKET_ADDRESS;

console.log(`Checking config...`);
console.log(`RPC: ${RPC_URL}`);
console.log(`Market Address: ${MARKET_ADDR}`);

if (!MARKET_ADDR) {
    console.error("❌ Market address missing!");
    process.exit(1);
}

const MARKET_ID = 4; // The market user bet on

async function main() {
    console.log(`🔍 Checking Market #${MARKET_ID} on ${MARKET_ADDR}...`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(MARKET_ADDR!, [
        'function markets(uint256) view returns (string, string[], uint256[], uint256, uint256, uint256, bool, uint256, uint256)',
        'function getAllPrices(uint256) view returns (uint256[])',
        'function getMarketOutcomes(uint256) view returns (string[])'
    ], provider);

    try {
        const [question, outcomesObj, pricesObj, liquidity, outcomeCount] = await contract.markets(MARKET_ID);
        const prices = await contract.getAllPrices(MARKET_ID);
        const outcomeNames = await contract.getMarketOutcomes(MARKET_ID);

        console.log(`\n📌 Question: ${question}`);
        console.log(`💧 Liquidity param: ${liquidity.toString()}`);
        console.log(`📊 Outcomes: ${outcomeCount}`);

        console.log('\n📈 Prices:');
        for (let i = 0; i < outcomeNames.length; i++) {
            const price = Number(prices[i]) / 100;
            console.log(`   ${outcomeNames[i]}: ${price}%`);
        }

    } catch (e: any) {
        console.error("❌ Error:", e.message);
    }
}

main();
