import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testCreateMarket() {
    try {
        const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-testnet.bnbchain.org';
        const provider = new ethers.JsonRpcProvider(rpcUrl, 97);
        const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
        
        const MARKET_ADDR = '0x95BEec73d2F473bB9Df7DC1b65637fB4CFc047Ae';
        
        console.log('🔍 Testing createMarket with different parameters...');
        console.log('Contract:', MARKET_ADDR);
        console.log('Signer:', signer.address);
        
        const contractABI = [
            'function createMarket(string memory _question, string[] memory _outcomes, uint256 _duration, uint256 _liquidityParam, uint256 _subsidy) external returns (uint256)',
            'function owner() view returns (address)',
            'function marketCount() view returns (uint256)'
        ];
        
        const contract = new ethers.Contract(MARKET_ADDR, contractABI, signer);
        
        // Check owner first
        const owner = await contract.owner();
        console.log('Owner:', owner);
        console.log('Is signer owner?', owner.toLowerCase() === signer.address.toLowerCase());
        
        // Test 1: Simple binary market with small liquidity
        console.log('\n🧪 Test 1: Simple binary market');
        try {
            const gasEstimate1 = await contract.createMarket.estimateGas(
                "Simple Test Market",
                ["Yes", "No"],
                86400, // 1 day
                ethers.parseUnits("100", 6), // 100 USDC (6 decimals)
                0 // No subsidy
            );
            console.log('✅ Test 1 passed - Gas estimate:', gasEstimate1.toString());
        } catch (e: any) {
            console.log('❌ Test 1 failed:', e.message.slice(0, 100));
        }
        
        // Test 2: Multi-outcome market
        console.log('\n🧪 Test 2: Multi-outcome market');
        try {
            const gasEstimate2 = await contract.createMarket.estimateGas(
                "Multi Test Market",
                ["Option A", "Option B", "Option C", "Option D"],
                86400,
                ethers.parseUnits("100", 6),
                0
            );
            console.log('✅ Test 2 passed - Gas estimate:', gasEstimate2.toString());
        } catch (e: any) {
            console.log('❌ Test 2 failed:', e.message.slice(0, 100));
        }
        
        // Test 3: Different liquidity parameter (18 decimals)
        console.log('\n🧪 Test 3: 18 decimal liquidity');
        try {
            const gasEstimate3 = await contract.createMarket.estimateGas(
                "Test Market 18 decimals",
                ["Yes", "No"],
                86400,
                ethers.parseUnits("100", 18), // 18 decimals
                0
            );
            console.log('✅ Test 3 passed - Gas estimate:', gasEstimate3.toString());
        } catch (e: any) {
            console.log('❌ Test 3 failed:', e.message.slice(0, 100));
        }
        
        // Test 4: Very small liquidity
        console.log('\n🧪 Test 4: Small liquidity');
        try {
            const gasEstimate4 = await contract.createMarket.estimateGas(
                "Small Liquidity Market",
                ["Yes", "No"],
                86400,
                BigInt(1000), // Just 1000 wei
                0
            );
            console.log('✅ Test 4 passed - Gas estimate:', gasEstimate4.toString());
        } catch (e: any) {
            console.log('❌ Test 4 failed:', e.message.slice(0, 100));
        }
        
    } catch (error: any) {
        console.error('❌ Error:', error.message);
    }
}

testCreateMarket();