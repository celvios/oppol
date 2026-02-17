const { ethers } = require('ethers');

const USER_ADDRESS = '0xCF00818E522D4110ab03838Cb46504b89D660e83';
// Try a few public RPCs
const RPC_URLS = [
    'https://bsc-dataseed1.binance.org/',
    'https://bsc-dataseed2.binance.org/',
    'https://1rpc.io/bnb'
];

const USDC_ADDRESS = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'; // Binance-Peg USDC
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'; // Binance-Peg BSC-USD

const ERC20_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
];

async function check() {
    console.log(`Checking balance for: ${USER_ADDRESS}`);

    let provider;
    for (const rpc of RPC_URLS) {
        try {
            console.log(`Trying RPC: ${rpc}`);
            provider = new ethers.JsonRpcProvider(rpc);
            await provider.getNetwork(); // Test connection
            console.log('Connected!');
            break;
        } catch (e) {
            console.log('Failed, trying next...');
        }
    }

    if (!provider) {
        console.error('All RPCs failed');
        return;
    }

    try {
        // BNB
        const bnbFor = await provider.getBalance(USER_ADDRESS);
        console.log(`BNB: ${ethers.formatEther(bnbFor)}`);

        // USDC
        const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
        const usdcBal = await usdc.balanceOf(USER_ADDRESS);
        const usdcDec = await usdc.decimals();
        console.log(`USDC: ${ethers.formatUnits(usdcBal, usdcDec)}`);

        // USDT
        const usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, provider);
        const usdtBal = await usdt.balanceOf(USER_ADDRESS);
        const usdtDec = await usdt.decimals();
        console.log(`USDT: ${ethers.formatUnits(usdtBal, usdtDec)}`);

    } catch (e) {
        console.error('Error fetching balances:', e.message);
    }
}

check();
