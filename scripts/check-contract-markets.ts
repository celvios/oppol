import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const CONTRACT_ADDRESS = '0xB6a211822649a61163b94cf46e6fCE46119D3E1b';
const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';

const ABI = [
    'function marketCount() view returns (uint256)',
    'function markets(uint256) view returns (string question, uint256 endTime, uint256 yesShares, uint256 noShares, uint256 liquidityParam, bool resolved, bool outcome, uint256 subsidyPool)'
];

async function checkMarkets() {
    console.log('🔍 Checking contract:', CONTRACT_ADDRESS);
    console.log('🌐 RPC:', RPC_URL);
    
    const provider = new ethers.JsonRpcProvider(RPC_URL, 97);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    
    try {
        const count = await contract.marketCount();
        console.log(`\n📊 Market Count: ${count.toString()}`);
        
        if (count > 0) {
            for (let i = 0; i < count; i++) {
                const market = await contract.markets(i);
                console.log(`\n--- Market ${i} ---`);
                console.log('Question:', market.question);
                console.log('End Time:', new Date(Number(market.endTime) * 1000).toISOString());
                console.log('Resolved:', market.resolved);
            }
        } else {
            console.log('\n⚠️  No markets found in contract');
        }
    } catch (error: any) {
        console.error('\n❌ Error:', error.message);
    }
}

checkMarkets();
