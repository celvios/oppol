import { ethers } from 'ethers';

const USER_ADDRESS = '0xCF00818E522D4110ab03838Cb46504b89D660e83';
const RPC_URL = 'https://1rpc.io/bnb';

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_CONTRACT || '0x55d398326f99059fF775485246999027B3197955';
const MARKET_ADDRESS = process.env.NEXT_PUBLIC_MARKET_ADDRESS;

const ERC20_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
];

const MARKET_ABI = [
    'function userBalances(address) view returns (uint256)',
];

async function checkBalances() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    console.log(`Checking balances for: ${USER_ADDRESS}\n`);

    // BNB Balance
    const bnbBalance = await provider.getBalance(USER_ADDRESS);
    console.log(`BNB Balance: ${ethers.formatEther(bnbBalance)} BNB`);

    // USDC Balance
    const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
    const usdcBalance = await usdcContract.balanceOf(USER_ADDRESS);
    const usdcDecimals = await usdcContract.decimals();
    console.log(`USDC Balance: ${ethers.formatUnits(usdcBalance, usdcDecimals)} USDC`);

    // USDT Balance
    const usdtContract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, provider);
    const usdtBalance = await usdtContract.balanceOf(USER_ADDRESS);
    const usdtDecimals = await usdtContract.decimals();
    console.log(`USDT Balance: ${ethers.formatUnits(usdtBalance, usdtDecimals)} USDT`);

    // Market Contract Deposited Balance
    if (MARKET_ADDRESS) {
        const marketContract = new ethers.Contract(MARKET_ADDRESS, MARKET_ABI, provider);
        const depositedBalance = await marketContract.userBalances(USER_ADDRESS);
        console.log(`Deposited in Market: ${ethers.formatUnits(depositedBalance, 18)} (using 18 decimals)`);
    }
}

checkBalances().catch(console.error);
