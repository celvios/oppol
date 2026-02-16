
import { ethers } from 'ethers';
import dotenv from 'dotenv';

// Load env vars
dotenv.config();


import fs from 'fs';

const LOG_FILE = 'relayer-balance-utf8.log';
const log = (msg: string) => {
    console.log(msg);
    fs.appendFileSync(LOG_FILE, msg + '\n');
};
fs.writeFileSync(LOG_FILE, '');

async function checkRelayerBalance() {
    log('--- Checking Relayer Wallet Balance ---');

    const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org';
    const chainId = Number(process.env.CHAIN_ID) || 56;
    const privateKey = process.env.PRIVATE_KEY;
    const USDC_ADDR = process.env.USDC_CONTRACT;

    if (!privateKey) {
        log('❌ PRIVATE_KEY missing in .env');
        return;
    }

    try {
        const provider = new ethers.JsonRpcProvider(rpcUrl, chainId);
        const wallet = new ethers.Wallet(privateKey, provider);

        log(`Address: ${wallet.address}`);

        // Check BNB
        const bnbBal = await provider.getBalance(wallet.address);
        log(`BNB Balance: ${ethers.formatEther(bnbBal)} BNB`);

        // Check USDC
        if (USDC_ADDR) {
            const erc20ABI = [
                'function balanceOf(address) view returns (uint256)',
                'function decimals() view returns (uint8)'
            ];
            const usdc = new ethers.Contract(USDC_ADDR, erc20ABI, provider);

            const [bal, dec] = await Promise.all([
                usdc.balanceOf(wallet.address),
                usdc.decimals()
            ]);

            const usdcBal = parseFloat(ethers.formatUnits(bal, dec)); // Correct decimals
            log(`USDC Balance: ${usdcBal} (Raw: ${bal}, Decimals: ${dec})`);

            // Check what it would have been with 6 decimals (buggy version)
            const baggyBal6 = parseFloat(ethers.formatUnits(bal, 6));
            log(`DEBUG: With 6 decimals (buggy), it would show: ${baggyBal6}`);

        } else {
            log('⚠️ USDC_CONTRACT not set in .env');
        }

    } catch (e: any) {
        log(`❌ Error: ${e.message}`);
    }
}

checkRelayerBalance();
