// Quick balance check + refund script
// Usage: node do-recover.js
require('dotenv').config({ path: '../../.env' });
const { ethers } = require('ethers');

const USER_WALLET = '0x42501490f7c291b4B28110900c9Bd81f3B35B849'; // User's MetaMask
const DESTINATION = '0xd0A115Ea64B59F951B70276fCb65b4946465e3a9'; // Where $3 went
const MARKET_CONTRACT = '0xe5a5320b3764Bd8FFFd95cF7aA7F406DaC2B070C';
const USDC_ADDR = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const ADMIN_KEY = process.env.PRIVATE_KEY;

const USDC_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function transfer(address to, uint256 amount) returns (bool)',
];
const MARKET_ABI = [
    'function userBalances(address) view returns (uint256)',
    'function withdraw(uint256 amount)',
];

async function main() {
    const provider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
    const usdc = new ethers.Contract(USDC_ADDR, USDC_ABI, provider);
    const market = new ethers.Contract(MARKET_CONTRACT, MARKET_ABI, provider);
    const dec = Number(await usdc.decimals().catch(() => 18));

    // --- balances ---
    const userMarket = await market.userBalances(USER_WALLET);
    const userWallet = await usdc.balanceOf(USER_WALLET);
    const destMarket = await market.userBalances(DESTINATION);
    const destWallet = await usdc.balanceOf(DESTINATION);

    console.log('\n========= BALANCE CHECK =========');
    console.log(`USER  WALLET  (${USER_WALLET.slice(0, 10)}...):`);
    console.log(`  USDC in wallet : ${ethers.formatUnits(userWallet, dec)}`);
    console.log(`  USDC in market : ${ethers.formatUnits(userMarket, 18)}`);
    console.log(`DEST  WALLET  (${DESTINATION.slice(0, 10)}...):`);
    console.log(`  USDC in wallet : ${ethers.formatUnits(destWallet, dec)}`);
    console.log(`  USDC in market : ${ethers.formatUnits(destMarket, 18)}`);

    const THREE = ethers.parseUnits('1', dec); // at least 1 USDC to bother

    // --- CASE 1: funds under USER in market already ---
    if (userMarket >= THREE) {
        console.log(`\n✅ $${ethers.formatUnits(userMarket, 18)} USDC is in the market under YOUR wallet.`);
        console.log('It is accessible as your game balance. No action needed — or withdraw via the app.');
        return;
    }

    // --- CASE 2: funds in DEST wallet as raw USDC ---
    if (destWallet >= THREE) {
        console.log(`\n💰 Found ${ethers.formatUnits(destWallet, dec)} USDC in destination wallet (raw).`);
        if (!ADMIN_KEY) { console.error('❌ No PRIVATE_KEY — cannot sign refund tx'); process.exit(1); }

        // Check if admin controls dest
        const adminWallet = new ethers.Wallet(ADMIN_KEY, provider);
        if (adminWallet.address.toLowerCase() !== DESTINATION.toLowerCase()) {
            console.log(`\n⚠️  Admin (${adminWallet.address}) does not control destination (${DESTINATION}).`);
            console.log('    The destination is a custodial wallet managed by the backend.');
            console.log('    Will look up the key from the database to refund...');
        }
    }

    // --- CASE 3: funds in DEST market ---
    if (destMarket >= THREE) {
        console.log(`\n💰 Found ${ethers.formatUnits(destMarket, 18)} USDC in MARKET under destination address.`);
    }

    if (userMarket < THREE && destWallet < THREE && destMarket < THREE) {
        console.log('\n❌ Could not locate the funds at the expected addresses. The $3 may have moved further.');
        console.log('   Check BSCScan logs tab of the tx for additional transfer events.');
    }
}

main().catch(console.error);
