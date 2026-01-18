import { ethers } from 'ethers';

const RPC_URL = 'https://bsc-testnet-rpc.publicnode.com';
const MULTI_MARKET_ADDRESS = '0xeA616854b8e87cB95628B5A65B9972d34D721710';

const ABI = [
    'function getMarketBasicInfo(uint256 marketId) view returns (tuple(string question, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome))',
    'function getMarketOutcomes(uint256 marketId) view returns (string[])',
    'function getMarketShares(uint256 marketId) view returns (uint256[])',
    'function getAllPrices(uint256 marketId) view returns (uint256[])',
    'function marketCount() view returns (uint256)'
];

async function checkMarkets() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(MULTI_MARKET_ADDRESS, ABI, provider);

    const count = await contract.marketCount();
    console.log(`\n📊 Total Markets: ${count}\n`);

    for (let i = 0; i < Number(count); i++) {
        try {
            const [basicInfo, outcomes, shares, prices] = await Promise.all([
                contract.getMarketBasicInfo(i),
                contract.getMarketOutcomes(i),
                contract.getMarketShares(i),
                contract.getAllPrices(i)
            ]);

            console.log(`\n=== Market #${i} ===`);
            console.log(`Question: ${basicInfo.question}`);
            console.log(`Outcomes: ${outcomes.join(', ')}`);
            console.log(`Shares: ${shares.map((s: bigint) => ethers.formatUnits(s, 6)).join(', ')}`);
            console.log(`Prices (basis points): ${prices.map((p: bigint) => Number(p)).join(', ')}`);
            console.log(`Prices (%): ${prices.map((p: bigint) => Number(p) / 100).join(', ')}`);
            console.log(`Liquidity Param: ${ethers.formatUnits(basicInfo.liquidityParam, 18)}`);
        } catch (e: any) {
            console.error(`Error fetching market ${i}:`, e.message);
        }
    }
}

checkMarkets().catch(console.error);
