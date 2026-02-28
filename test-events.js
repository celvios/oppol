require('dotenv').config({ path: '.env' });
const { ethers } = require('ethers');
const MARKET_ABI = [
    "function marketCount() view returns (uint256)",
    "event SharesPurchased(uint256 indexed marketId, address indexed user, uint256 outcomeIndex, uint256 shares, uint256 cost)"
];

async function checkEvents() {
    try {
        const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-rpc.publicnode.com';
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        const MARKET_ADDR = process.env.MARKET_CONTRACT || process.env.NEXT_PUBLIC_MARKET_ADDRESS;
        console.log('Market Address:', MARKET_ADDR);

        const contract = new ethers.Contract(MARKET_ADDR, MARKET_ABI, provider);

        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 10000);
        console.log(`Querying events from ${fromBlock} to ${currentBlock}...`);

        const filter = contract.filters.SharesPurchased();
        const logs = await contract.queryFilter(filter, fromBlock, currentBlock);

        console.log(`Found ${logs.length} SharesPurchased events in the last 10000 blocks.`);
        if (logs.length > 0) {
            console.log('Sample Log:', {
                marketId: logs[0].args[0].toString(),
                user: logs[0].args[1],
                outcomeIndex: logs[0].args[2].toString(),
                shares: ethers.formatUnits(logs[0].args[3], 18),
                cost: ethers.formatUnits(logs[0].args[4], 18),
                txHash: logs[0].transactionHash
            });
        }
    } catch (e) {
        console.error('Error fetching events:', e);
    }
}
checkEvents();
