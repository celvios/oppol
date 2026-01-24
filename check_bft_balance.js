const { ethers } = require('ethers');
require('dotenv').config();

async function checkBFTBalance() {
    const provider = new ethers.JsonRpcProvider('https://bsc-rpc.publicnode.com');
    
    // BFT token contract
    const bftAddress = '0xB929177331De755d7aCc5665267a247e458bCdeC';
    const abi = ['function balanceOf(address owner) view returns (uint256)', 'function decimals() view returns (uint8)'];
    
    const bftContract = new ethers.Contract(bftAddress, abi, provider);
    
    // Your wallet address (replace with actual address)
    const walletAddress = process.env.WALLET_ADDRESS || '0xYourWalletAddress';
    
    try {
        const balance = await bftContract.balanceOf(walletAddress);
        const decimals = await bftContract.decimals();
        const formattedBalance = ethers.formatUnits(balance, decimals);
        
        console.log(`BFT Token Balance: ${formattedBalance}`);
        console.log(`Required: 1 BFT`);
        console.log(`Can create markets: ${parseFloat(formattedBalance) >= 1 ? 'YES' : 'NO'}`);
        
    } catch (error) {
        console.error('Error checking balance:', error.message);
    }
}

checkBFTBalance();