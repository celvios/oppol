
import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
const USDC_ADDRESS = process.env.USDC_CONTRACT || '0x16E4A3d9697D47c61De3bDD1DdDa4148aA09D634';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const USDC_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)'
];

async function sendUSDC() {
    const targetAddress = '0x499B588bd23e7496FEf6e6c2D8b4EE9b8864a1bd';
    const amount = '5000';

    if (!PRIVATE_KEY) {
        console.error('❌ Missing PRIVATE_KEY in env');
        return;
    }

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet);

        console.log(`--- Sending ${amount} USDC ---`);
        console.log(`From: ${wallet.address}`);
        console.log(`To:   ${targetAddress}`);

        const decimals = await usdcContract.decimals();
        const amountWei = ethers.parseUnits(amount, decimals);

        const balance = await usdcContract.balanceOf(wallet.address);
        console.log(`Operator Balance: ${ethers.formatUnits(balance, decimals)} USDC`);

        if (balance < amountWei) {
            console.error('❌ Insufficient balance');
            return;
        }

        const tx = await usdcContract.transfer(targetAddress, amountWei);
        console.log(`⏳ Transaction sent: ${tx.hash}`);
        await tx.wait();
        console.log('✅ Transfer Successful!');

    } catch (error: any) {
        console.error('Transfer failed:', error.message);
    }
}

sendUSDC();
