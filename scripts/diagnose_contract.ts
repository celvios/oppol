import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function diagnoseContract() {
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
        
        // Check if contract exists
        const code = await provider.getCode(MARKET_ADDR);
        console.log('📄 Contract has code:', code !== '0x');
        
        if (code === '0x') {
            console.log('❌ No contract deployed at this address!');
            return;
        }
        
        // Try basic calls one by one
        console.log('\n🧪 Testing basic contract calls...');
        
        try {
            const ownerABI = ['function owner() view returns (address)'];
            const ownerContract = new ethers.Contract(MARKET_ADDR, ownerABI, provider);
            const owner = await ownerContract.owner();
            console.log('✅ Owner call successful:', owner);
            console.log('🤔 Is server wallet the owner?', owner.toLowerCase() === serverWallet.address.toLowerCase());
        } catch (e: any) {
            console.log('❌ Owner call failed:', e.message);
        }
        
        try {
            const countABI = ['function marketCount() view returns (uint256)'];
            const countContract = new ethers.Contract(MARKET_ADDR, countABI, provider);
            const count = await countContract.marketCount();
            console.log('✅ Market count call successful:', count.toString());
        } catch (e: any) {
            console.log('❌ Market count call failed:', e.message);
        }
        
        // Try to call operators function with raw call
        try {
            console.log('\n🔍 Testing operators function...');
            const operatorSelector = ethers.id('operators(address)').slice(0, 10);
            const paddedAddress = ethers.zeroPadValue(serverWallet.address, 32);
            const callData = operatorSelector + paddedAddress.slice(2);
            
            console.log('📞 Call data:', callData);
            
            const result = await provider.call({
                to: MARKET_ADDR,
                data: callData
            });
            
            console.log('✅ Raw operators call successful:', result);
            const isOperator = result === '0x0000000000000000000000000000000000000000000000000000000000000001';
            console.log('🔧 Is operator?', isOperator);
        } catch (e: any) {
            console.log('❌ Raw operators call failed:', e.message);
        }
        
        // Test a simple createMarket call to see what specific error we get
        console.log('\n🧪 Testing createMarket call...');
        try {
            const createMarketABI = [
                'function createMarket(string memory _question, string[] memory _outcomes, uint256 _duration, uint256 _liquidityParam, uint256 _subsidy) external returns (uint256)'
            ];
            const signer = new ethers.Wallet(SERVER_PRIVATE_KEY, provider);
            const contract = new ethers.Contract(MARKET_ADDR, createMarketABI, signer);
            
            // Try to estimate gas for a simple market creation
            const gasEstimate = await contract.createMarket.estimateGas(
                "Test Market",
                ["Yes", "No"],
                86400, // 1 day
                ethers.parseUnits("1000", 18), // 1000 * 1e18
                0 // No subsidy
            );
            
            console.log('✅ Gas estimate successful:', gasEstimate.toString());
        } catch (e: any) {
            console.log('❌ CreateMarket gas estimation failed:', e.message);
            
            // Check if it's a specific revert reason
            if (e.message.includes('Invalid outcome count')) {
                console.log('💡 Issue: Invalid outcome count');
            } else if (e.message.includes('Invalid liquidity param')) {
                console.log('💡 Issue: Invalid liquidity parameter');
            } else if (e.message.includes('Ownable: caller is not the owner')) {
                console.log('💡 Issue: Not the owner');
            } else {
                console.log('💡 Issue: Unknown contract error');
            }
        }
        
    } catch (error: any) {
        console.error('❌ Error:', error.message);
    }
}

diagnoseContract();