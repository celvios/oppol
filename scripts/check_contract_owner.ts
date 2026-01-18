import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkContractOwner() {
    try {
        const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-testnet.bnbchain.org';
        const provider = new ethers.JsonRpcProvider(rpcUrl, 97);
        
        const MARKET_ADDR = process.env.MULTI_MARKET_ADDRESS || '0x95BEec73d2F473bB9Df7DC1b65637fB4CFc047Ae';
        const SERVER_PRIVATE_KEY = process.env.PRIVATE_KEY;
        
        if (!SERVER_PRIVATE_KEY) {
            throw new Error('PRIVATE_KEY not found in .env');
        }
        
        const serverWallet = new ethers.Wallet(SERVER_PRIVATE_KEY);
        console.log('🔍 Server wallet address:', serverWallet.address);
        console.log('🔍 Contract address:', MARKET_ADDR);
        
        const contractABI = [
            'function owner() view returns (address)',
            'function operators(address) view returns (bool)',
            'function marketCount() view returns (uint256)'
        ];
        
        const contract = new ethers.Contract(MARKET_ADDR, contractABI, provider);
        
        // Check owner
        const owner = await contract.owner();
        console.log('👑 Contract owner:', owner);
        console.log('🤔 Is server wallet the owner?', owner.toLowerCase() === serverWallet.address.toLowerCase());
        
        // Check operator status
        const isOperator = await contract.operators(serverWallet.address);
        console.log('🔧 Is server wallet an operator?', isOperator);
        
        // Check market count
        const marketCount = await contract.marketCount();
        console.log('📊 Current market count:', marketCount.toString());
        
        console.log('\n💡 Solution:');
        if (owner.toLowerCase() === serverWallet.address.toLowerCase()) {
            console.log('✅ Server wallet is the owner - market creation should work');
        } else if (isOperator) {
            console.log('⚠️  Server wallet is operator but not owner');
            console.log('   The createMarket function requires owner privileges');
            console.log('   Need to either:');
            console.log('   1. Transfer ownership to server wallet, OR');
            console.log('   2. Modify contract to allow operators to create markets');
        } else {
            console.log('❌ Server wallet has no privileges');
            console.log('   Need to set as operator first, then address owner issue');
        }
        
    } catch (error: any) {
        console.error('❌ Error:', error.message);
    }
}

checkContractOwner();