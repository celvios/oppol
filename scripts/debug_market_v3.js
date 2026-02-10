require('dotenv').config();
const { ethers } = require('ethers');
console.log(`Ethers version: ${ethers.version}`);

const RPC_URL = process.env.BNB_RPC_URL || 'https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0';
const MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || '0xe3Eb84D7e271A5C44B27578547f69C80c497355B';

const ABI = [
    'function marketCount() view returns (uint256)',
    'function getMarketBasicInfo(uint256) view returns (string question, string image, string description, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)',
    'function getMarketOutcomes(uint256) view returns (string[])',
    'function getAllPrices(uint256) view returns (uint256[])',
    'function getMarketShares(uint256) view returns (uint256[])',
    'function calculateCost(uint256 marketId, uint256 outcomeIndex, uint256 count) view returns (uint256)',
];

async function main() {
    console.log(`Connecting to ${RPC_URL}...`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(MARKET_ADDR, ABI, provider);

    try {
        const count = await contract.marketCount();
        console.log(`Total Markets: ${count}`);

        for (let i = 0; i < Number(count); i++) {
            console.log(`\n--- Market #${i} ---`);
            try {
                const basic = await contract.getMarketBasicInfo(i);
                console.log(`Question: ${basic.question}`);
                console.log(`Liquidity Param: ${basic.liquidityParam.toString()}`);

                const shares = await contract.getMarketShares(i);
                console.log(`Shares (Open Interest): ${shares.map(s => s.toString()).join(', ')}`);

                const prices = await contract.getAllPrices(i);
                console.log(`Prices (Raw 1e18): ${prices.map(p => p.toString()).join(', ')}`);
                console.log(`Prices (%): ${prices.map(p => (Number(ethers.formatUnits(p, 18)) * 100).toFixed(2)).join('%, ')}%`);

                // Check Cost for Outcome 0 (BUY 1 SHARE)
                try {
                    // Try buying 1 share (1e18 units because shares are 1e18?)
                    const oneShare = ethers.parseUnits("1", 18);
                    const cost = await contract.calculateCost(i, 0, oneShare);
                    console.log(`Cost for 1.0 Share: ${ethers.formatUnits(cost, 18)} (Raw: ${cost.toString()})`);
                } catch (e) {
                    console.log(`Calc Cost Error: ${e.message}`);
                }

            } catch (e) {
                console.log(`Error reading market ${i}: ${e.message}`);
            }
        }
    } catch (e) {
        console.error("Critical Error:", e);
    }
}

main();
