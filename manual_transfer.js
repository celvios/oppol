const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Contract Addresses
const USDC_ADDRESS = process.env.USDC_CONTRACT || process.env.NEXT_PUBLIC_USDC_CONTRACT;
const RPC_URL = process.env.RPC_URL || 'https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/';

async function main() {
    console.log('--- Manual Fund Transfer ---');
    console.log('RPC:', RPC_URL);
    console.log('USDC:', USDC_ADDRESS);

    if (!process.env.PRIVATE_KEY) {
        throw new Error('Missing PRIVATE_KEY in .env');
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const target = '0xE434423371E3AacAF0fF8fC0B3Ef1F521e82CCC1';

    // Check USDT/USDC balance of Admin
    const usdcAbi = [
        'function balanceOf(address) view returns (uint256)',
        'function transfer(address, uint256) returns (bool)',
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)'
    ];
    const usdc = new ethers.Contract(USDC_ADDRESS, usdcAbi, wallet);

    try {
        const symbol = await usdc.symbol();
        const decimals = await usdc.decimals();
        const balance = await usdc.balanceOf(wallet.address);

        console.log('Admin Wallet:', wallet.address);
        console.log(`Admin ${symbol} Balance:`, ethers.formatUnits(balance, decimals));

        // Amount to send: $1.00
        const amount = ethers.parseUnits('1.0', decimals);

        if (balance < amount) {
            console.error(`Insufficient funds in Admin Wallet to send 1.0 ${symbol}`);
            return;
        }

        console.log(`Sending 1.0 ${symbol} to`, target);
        const tx = await usdc.transfer(target, amount);
        console.log('Tx Hash:', tx.hash);

        console.log('Waiting for confirmation...');
        await tx.wait();
        console.log('Confirmed!');
    } catch (e) {
        console.error('Error:', e);
    }
}

main();
