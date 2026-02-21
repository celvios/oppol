// fund-old.js - sends BNB to the old owner wallet to trigger the rescue watcher
const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const OLD_OWNER_ADDR = '0xa4B1B886f955b2342bC9bB4f7B80839357378b76';

async function main() {
    const provider = new ethers.JsonRpcProvider('https://bsc-dataseed1.binance.org/');
    const safeWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    const safeBal = await provider.getBalance(safeWallet.address);
    console.log('Safe wallet BNB:', ethers.formatEther(safeBal));

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice;
    // Send small amount — just enough for 1 withdraw + 1 transfer + buffer
    const amount = gasPrice * 500000n + ethers.parseEther('0.001');
    console.log('Sending', ethers.formatEther(amount), 'BNB to old owner...');

    const tx = await safeWallet.sendTransaction({
        to: OLD_OWNER_ADDR,
        value: amount,
        gasLimit: 21000n,
        gasPrice: gasPrice * 3n // outbid to confirm fast
    });
    console.log('Funding tx:', tx.hash);
    await tx.wait();
    console.log('✅ BNB landed! Watcher should now fire...');
}

main().catch(e => console.error('Fund failed:', e.message));
