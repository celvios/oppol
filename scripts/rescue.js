/**
 * RESCUE PHASE 1: Watch for BNB arrival and execute immediately
 * 
 * USAGE:
 * 1. Run this script first (it will watch for BNB)
 * 2. In a SEPARATE terminal, run: node scripts/fund-old.js
 * 3. This script reacts instantly when BNB arrives
 */
const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const OLD_KEY = '0x9e45d80adad2f53d67fe3bbda4c107643d523e8ce65ccd10f3066504b4f12fd8';
const USDC = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';

async function main() {
    const provider = new ethers.JsonRpcProvider('https://bsc-dataseed1.binance.org/');
    const oldOwner = new ethers.Wallet(OLD_KEY, provider);
    const safeWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const contractAddr = process.env.MARKET_CONTRACT;

    console.log('Old owner:', oldOwner.address);
    console.log('Safe wallet:', safeWallet.address);
    console.log('Watching for BNB...\n');

    const usdc = new ethers.Contract(USDC, ['function balanceOf(address) view returns (uint256)'], provider);
    const iface = new ethers.Interface([
        'function emergencyWithdraw(address,address,uint256) external',
        'function transferOwnership(address) external'
    ]);

    let executed = false;

    // Poll every 500ms for BNB balance
    const poll = setInterval(async () => {
        if (executed) return;
        try {
            const bnbBal = await provider.getBalance(oldOwner.address);
            if (bnbBal === 0n) {
                process.stdout.write('.');
                return;
            }

            // BNB arrived! Execute immediately
            executed = true;
            clearInterval(poll);
            console.log('\n🚀 BNB detected: ' + ethers.formatEther(bnbBal) + ' BNB! Executing rescue NOW...');

            const feeData = await provider.getFeeData();
            const gasPrice = feeData.gasPrice;
            const usdcBal = await usdc.balanceOf(contractAddr);
            console.log('USDC to rescue:', ethers.formatUnits(usdcBal, 18));

            // Step 1: Pull all USDC
            const contract = new ethers.Contract(contractAddr, iface.fragments, oldOwner);
            console.log('Calling emergencyWithdraw...');
            const t1 = await contract.emergencyWithdraw(USDC, safeWallet.address, usdcBal, {
                gasLimit: 350000,
                gasPrice
            });
            console.log('Withdraw tx sent:', t1.hash);
            await t1.wait();
            console.log('✅ USDC RESCUED!');

            // Step 2: Transfer ownership
            console.log('Transferring ownership...');
            const t2 = await contract.transferOwnership(safeWallet.address, {
                gasLimit: 100000,
                gasPrice
            });
            console.log('Transfer tx sent:', t2.hash);
            await t2.wait();
            console.log('✅ OWNERSHIP TRANSFERRED!');

            const remaining = await usdc.balanceOf(contractAddr);
            const safeUSDC = await usdc.balanceOf(safeWallet.address);
            console.log('\n=== RESCUE COMPLETE ===');
            console.log('USDC in safe wallet:', ethers.formatUnits(safeUSDC, 18));
            console.log('USDC left in contract:', ethers.formatUnits(remaining, 18));
            process.exit(0);

        } catch (e) {
            if (!e.message.includes('insufficient')) {
                console.error('\nError:', e.message);
            }
        }
    }, 500);

    console.log('NOW run in another terminal: node scripts/fund-old.js');
}

main().catch(console.error);
