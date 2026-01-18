import { ethers } from 'ethers';

const RPC_URL = 'https://bsc-testnet-rpc.publicnode.com';
const CONTRACT_ADDRESS = '0xeA616854b8e87cB95628B5A65B9972d34D721710';

const ABI = [
    'function marketCount() view returns (uint256)',
    'function getMarketBasicInfo(uint256) view returns (tuple(string question, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome))',
    'function getMarketOutcomes(uint256) view returns (string[])',
    'function getMarketShares(uint256) view returns (uint256[])',
    'function getAllPrices(uint256) view returns (uint256[])'
];

async function checkMarketPrices() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    console.log('\n🔍 Checking all markets on contract:', CONTRACT_ADDRESS);
    console.log('='.repeat(80));

    const count = await contract.marketCount();
    console.log(`\nTotal Markets: ${count}\n`);

    for (let i = 0; i < Number(count); i++) {
        try {
            const [basicInfo, outcomes, shares, prices] = await Promise.all([
                contract.getMarketBasicInfo(i),
                contract.getMarketOutcomes(i),
                contract.getMarketShares(i),
                contract.getAllPrices(i)
            ]);

            console.log(`\n📊 Market #${i}`);
            console.log(`Question: ${basicInfo.question}`);
            console.log(`Liquidity: ${ethers.formatUnits(basicInfo.liquidityParam, 18)}`);
            console.log('\nOutcomes:');

            outcomes.forEach((outcome: string, idx: number) => {
                const shareAmount = ethers.formatUnits(shares[idx], 6);
                const price = Number(prices[idx]) / 100; // Convert basis points to percentage
                console.log(`  ${idx}. ${outcome}`);
                console.log(`     Shares: ${shareAmount}`);
                console.log(`     Price: ${price.toFixed(2)}%`);
            });

            // Calculate total to verify prices sum to 100%
            const totalPrice = prices.reduce((sum: number, p: bigint) => sum + Number(p), 0) / 100;
            console.log(`\n  Total Price: ${totalPrice.toFixed(2)}% (should be ~100%)`);
            console.log('-'.repeat(60));

        } catch (e: any) {
            console.error(`❌ Error fetching market ${i}:`, e.message);
        }
    }
}

checkMarketPrices().catch(console.error);
