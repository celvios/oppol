const { ethers } = require('ethers');

const MARKET_CONTRACT = '0x9C3485D2c43953A29F6dD4F09EC992e58899Fc0e'; // Replace with actual address
const RPC_URL = 'https://bsc-rpc.publicnode.com';

const ABI = [
    'function getAllPrices(uint256) view returns (uint256[])',
    'function getMarketShares(uint256) view returns (uint256[])',
    'function getMarketBasicInfo(uint256) view returns (string, string, string, uint256, uint256, uint256, bool, uint256)',
    'function marketCount() view returns (uint256)'
];

async function queryContract() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(MARKET_CONTRACT, ABI, provider);

    try {
        console.log('🔍 Querying contract:', MARKET_CONTRACT);
        console.log('📡 RPC:', RPC_URL);
        
        const marketCount = await contract.marketCount();
        console.log('\n📊 Market Count:', marketCount.toString());

        if (marketCount > 0) {
            const marketId = 0;
            console.log(`\n🎯 Querying Market #${marketId}:`);
            
            const basicInfo = await contract.getMarketBasicInfo(marketId);
            console.log('Question:', basicInfo[0]);
            console.log('Outcome Count:', basicInfo[3].toString());
            console.log('End Time:', new Date(Number(basicInfo[4]) * 1000).toLocaleString());
            console.log('Liquidity Param (raw):', basicInfo[5].toString());
            console.log('Liquidity Param (USDC):', ethers.formatUnits(basicInfo[5], 6));
            console.log('Resolved:', basicInfo[6]);

            const shares = await contract.getMarketShares(marketId);
            console.log('\n📈 Shares:', shares.map(s => s.toString()));
            console.log('Shares (formatted):', shares.map(s => ethers.formatUnits(s, 6)));

            const prices = await contract.getAllPrices(marketId);
            console.log('\n💰 Prices (raw):', prices.map(p => p.toString()));
            console.log('Prices (basis points):', prices.map(p => Number(p)));
            console.log('Prices (percentage):', prices.map(p => Number(p) / 100 + '%'));

            console.log('\n✅ Contract is responding correctly!');
            if (prices.every(p => Number(p) < 100)) {
                console.log('⚠️  WARNING: Prices are extremely low - contract may have precision issues');
            }
        }
    } catch (error) {
        console.error('❌ Error querying contract:', error.message);
    }
}

queryContract();
