const { ethers } = require('ethers');

// Transaction from the screenshot
const TX_HASH = '0x76b7707a8f70cdbef6b0326c3ddb7eaf1dae420a9852c3ceb37b6977bcde362e';
const DESTINATION = '0xd0A115Ea64B59F951B70276fCb65b4946465e3a9';
const MARKET_CONTRACT = '0xe5a5320b3764Bd8FFFd95cF7aA7F406DaC2B070C';
const USDC_ADDR = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';

const USDC_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
];
const MARKET_ABI = [
    'function userBalances(address) view returns (uint256)',
    'function withdraw(uint256 amount)',
    'function deposit(uint256 amount)',
];

async function main() {
    const provider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
    const usdc = new ethers.Contract(USDC_ADDR, USDC_ABI, provider);
    const market = new ethers.Contract(MARKET_CONTRACT, MARKET_ABI, provider);

    const decimals = await usdc.decimals().catch(() => 18);

    // Check destination wallet
    const destUSDCBal = await usdc.balanceOf(DESTINATION);
    const destMarketBal = await market.userBalances(DESTINATION);

    console.log('\n=== DESTINATION ADDRESS BREAKDOWN ===');
    console.log(`Address: ${DESTINATION}`);
    console.log(`USDC Wallet Balance: ${ethers.formatUnits(destUSDCBal, decimals)} USDC`);
    console.log(`Market Contract Balance: ${ethers.formatUnits(destMarketBal, 18)} USDC`);

    // Also check the transaction receipt to find the true recipient
    const receipt = await provider.getTransactionReceipt(TX_HASH);
    if (receipt) {
        console.log('\n=== TRANSACTION RECEIPT ===');
        console.log(`Status: ${receipt.status === 1 ? 'SUCCESS' : 'FAILED'}`);
        console.log(`Block: ${receipt.blockNumber}`);
        console.log(`From: ${receipt.from}`);
        console.log(`To: ${receipt.to}`);
        console.log(`Gas Used: ${receipt.gasUsed}`);
        console.log(`Logs: ${receipt.logs.length}`);
    }

    console.log('\n=== WHAT TO DO ===');
    if (destMarketBal > 0n) {
        console.log(`✅ Found ${ethers.formatUnits(destMarketBal, 18)} USDC in market contract for destination address.`);
        console.log('The funds are in the market contract under the destination address.');
        console.log('To recover: call market.withdraw() from destination address, then transfer USDC to user wallet.');
    } else if (destUSDCBal > 0n) {
        console.log(`✅ Found ${ethers.formatUnits(destUSDCBal, decimals)} USDC in wallet of destination address.`);
    } else {
        console.log('❌ No funds found at destination. The address may have already deposited or the funds moved further.');
    }
}

main().catch(console.error);
