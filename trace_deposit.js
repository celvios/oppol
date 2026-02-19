
const { ethers } = require('ethers');
require('dotenv').config({ debug: true });

// User's custodial address from logs
const CUSTODIAL_ADDR = '0xD5EeB48921F15Cdc0863fAA841fc08F998b9e55f';
const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org';

// Contracts
const USDC_ADDR = process.env.NEXT_PUBLIC_USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const USDT_ADDR = process.env.NEXT_PUBLIC_USDT_CONTRACT || '0x55d398326f99059fF775485246999027B3197955';

async function main() {
    console.log('--- Tracing Deposit ---');
    console.log(`Target Wallet: ${CUSTODIAL_ADDR}`);
    console.log(`RPC: ${RPC_URL}`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // 1. Check BNB
    const bnbBal = await provider.getBalance(CUSTODIAL_ADDR);
    console.log(`BNB Balance: ${ethers.formatEther(bnbBal)} BNB`);

    // 2. Check USDC
    const abi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];

    // USDC
    try {
        const usdc = new ethers.Contract(USDC_ADDR, abi, provider);
        const bal = await usdc.balanceOf(CUSTODIAL_ADDR);
        const dec = await usdc.decimals().catch(() => 18n);
        console.log(`USDC Balance: ${ethers.formatUnits(bal, dec)} USDC (Address: ${USDC_ADDR})`);
    } catch (e) {
        console.error('Failed to check USDC:', e.message);
    }

    // USDT
    try {
        const usdc = new ethers.Contract(USDT_ADDR, abi, provider);
        const bal = await usdc.balanceOf(CUSTODIAL_ADDR);
        const dec = await usdc.decimals().catch(() => 18n);
        const log = `USDT Balance: ${ethers.formatUnits(bal, dec)} USDT (Address: ${USDT_ADDR})`;
        console.log(log);
        require('fs').appendFileSync('deposit_log.txt', log + '\n');
    } catch (e) {
        console.error('Failed to check USDT:', e.message);
    }
}

main().catch(console.error);
