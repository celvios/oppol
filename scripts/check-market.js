
const { ethers } = require('ethers');
require('dotenv').config();

const MARKET_ID = 4;
const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org';
const MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MULTI_MARKET_ADDRESS;

console.log('--- START ---');
console.log(`RPC: ${RPC_URL}`);
console.log(`Contract: ${MARKET_ADDR}`);

if (!MARKET_ADDR) {
    console.error("❌ Contract address missing in .env");
    process.exit(1);
}

async function main() {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const contract = new ethers.Contract(MARKET_ADDR, [
            'function getMarketBasicInfo(uint256) view returns (string question, string image, string description, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)',
            'function getMarketOutcomes(uint256) view returns (string[])',
            'function getMarketShares(uint256) view returns (uint256[])',
            'function getAllPrices(uint256) view returns (uint256[])',
            'function userBalances(address) view returns (uint256)',
            'event SharesPurchased(uint256 indexed marketId, address indexed user, uint256 outcomeIndex, uint256 shares, uint256 cost)'
        ], provider);

        console.log(`\n🔍 Verification for Market #${MARKET_ID}`);

        // 1. Check Basic Info
        const basicInfo = await contract.getMarketBasicInfo(MARKET_ID);
        const question = basicInfo.question;
        const liquidity = basicInfo.liquidityParam;

        console.log(`Question: ${question}`);
        console.log(`Liquidity: ${ethers.formatUnits(liquidity, 18)}`); // Probably 18 decimals internally based on findings

        // 2. Check Prices
        const prices = await contract.getAllPrices(MARKET_ID);
        const outcomes = await contract.getMarketOutcomes(MARKET_ID);

        console.log('\n📊 Current Prices:');
        for (let i = 0; i < outcomes.length; i++) {
            const price = Number(prices[i]) / 100;
            console.log(`   ${outcomes[i]}: ${price.toFixed(2)}%`);
        }

        // 3. Check Open Interest (Shares)
        const shares = await contract.getMarketShares(MARKET_ID);
        console.log('\n📈 Open Interest (Shares Outstanding):');
        for (let i = 0; i < outcomes.length; i++) {
            console.log(`   ${outcomes[i]}: ${ethers.formatUnits(shares[i], 18)} shares`);
        }

        // 4. Calculate Volume from Events
        console.log('\n🔊 Calculating Volume from Events...');
        const blockNumber = await provider.getBlockNumber();
        const fromBlock = blockNumber - 20000; // Look back ~16 hours (20k blocks @ 3s)

        const filter = contract.filters.SharesPurchased(MARKET_ID);
        const logs = await contract.queryFilter(filter, fromBlock, 'latest');

        let totalVolume = BigInt(0);
        logs.forEach(log => {
            const cost = log.args[4]; // args: [marketId, user, outcomeIndex, shares, cost]
            totalVolume += cost;
        });

        console.log(`   Total Volume: ${ethers.formatUnits(totalVolume, 18)} USDC`); // Assuming cost is 18 decimals in event? 
        // Wait, app.ts says cost is 6 decimals when deducting from user, but contract events might rely on internal logic?
        // Let's verify event definition: event SharesPurchased(..., uint256 cost);
        // In buySharesV3: emit SharesPurchased(..., totalCost);
        // totalCost is deducted from userBalances. userBalances tracks USDC (6 decimals) if token is USDC.
        // BUT contract might be using internal 18 decimals for userBalances if it did a conversion?
        // Checked PredictionMarketMultiV2.sol: userBalances maps address => uint256. 
        // deposit() does token.transferFrom(..., amount). 
        // If token is USDC (6 decimals), then userBalances is 6 decimals.
        // So volume is likely 6 decimals.

        console.log(`   (If 6 decimals): ${ethers.formatUnits(totalVolume, 6)} USDC`);

        // 5. Check User Balance

        const userAddr = '0xE434423371E3AacAF0fF8fC0B3Ef1F521e82CCC1'; // From logs
        const bal = await contract.userBalances(userAddr);
        console.log(`\n💰 User Balance (${userAddr}):`);
        console.log(`   ${ethers.formatUnits(bal, 18)} USDC`);

    } catch (e) {
        console.error("\n❌ Error:", e.message);
    }
}

main();
