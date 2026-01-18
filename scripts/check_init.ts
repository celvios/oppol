import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkInitialization() {
    const provider = new ethers.JsonRpcProvider(process.env.BNB_RPC_URL!, 97);
    const MARKET_ADDR = '0x95BEec73d2F473bB9Df7DC1b65637fB4CFc047Ae';
    
    const abi = [
        'function token() view returns (address)',
        'function oracle() view returns (address)',
        'function marketCount() view returns (uint256)'
    ];
    
    const contract = new ethers.Contract(MARKET_ADDR, abi, provider);
    
    try {
        const token = await contract.token();
        const oracle = await contract.oracle();
        const count = await contract.marketCount();
        
        console.log('Token address:', token);
        console.log('Oracle address:', oracle);
        console.log('Market count:', count.toString());
        
        if (token === '0x0000000000000000000000000000000000000000') {
            console.log('❌ Contract not initialized - token is zero address');
        } else {
            console.log('✅ Contract appears initialized');
        }
    } catch (e: any) {
        console.log('❌ Error checking initialization:', e.message);
    }
}

checkInitialization();