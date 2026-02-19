
const { Client } = require('pg');
const { ethers } = require('ethers');
const crypto = require('crypto');
require('dotenv').config();

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org/';
const USDT_ADDR = process.env.NEXT_PUBLIC_USDT_CONTRACT || '0x55d398326f99059fF775485246999027B3197955';
const USDC_ADDR = process.env.NEXT_PUBLIC_USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
// PancakeSwap Router v2
const ROUTER_ADDR = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

const TARGET_USER_ID = '72d68b9c-f4a4-43ed-b8a8-151c3f5c9322';

// Encryption setup
const ALGORITHM = 'aes-256-gcm';
const DEFAULT_KEY_HEX = '1ef5d56bb056a08019ea2f34e6540211eacfd3fff109bcf98d483da21db2b3c5';
let encryptEnv = process.env.ENCRYPTION_KEY || DEFAULT_KEY_HEX;
let KEY = Buffer.from(encryptEnv, 'hex');
if (KEY.length !== 32) KEY = Buffer.from(DEFAULT_KEY_HEX, 'hex');

function decrypt(encryptedData) {
    try {
        const parts = encryptedData.split(':');
        if (parts.length !== 3) throw new Error('Invalid format');
        const [ivHex, authTagHex, encrypted] = parts;
        const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        console.error('Decryption failed:', e.message);
        throw e;
    }
}

async function main() {
    console.log(`Debug Swap V2 (Router) for User: ${TARGET_USER_ID}`);
    const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();

    // 1. Get Wallet
    const res = await client.query('SELECT public_address, encrypted_private_key FROM wallets WHERE user_id = $1', [TARGET_USER_ID]);
    if (res.rows.length === 0) { console.error('User not found'); return; }

    const wallet = res.rows[0];
    const custodialAddress = wallet.public_address;
    console.log(`Custodial Address: ${custodialAddress}`);

    const privateKey = decrypt(wallet.encrypted_private_key);
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(privateKey, provider);

    // 2. Check Balances
    const usdtAbi = ['function balanceOf(address) view returns (uint256)', 'function approve(address, uint256) returns (bool)', 'function decimals() view returns (uint8)', 'function allowance(address, address) view returns (uint256)'];
    const usdt = new ethers.Contract(USDT_ADDR, usdtAbi, signer);

    const balRaw = await usdt.balanceOf(custodialAddress);
    const formatted = ethers.formatUnits(balRaw, 18); // USDT is 18
    console.log(`USDT Balance: ${formatted}`);

    if (parseFloat(formatted) < 0.1) {
        console.log('Balance too low to swap.');
        return;
    }

    // 3. Approve Router
    console.log('Approving Router...');
    const allowance = await usdt.allowance(custodialAddress, ROUTER_ADDR);
    if (allowance < balRaw) {
        const estGas = await usdt.approve.estimateGas(ROUTER_ADDR, balRaw).catch(() => 60000n);
        // Check BNB
        const bnb = await provider.getBalance(custodialAddress);
        if (bnb < ethers.parseEther("0.001")) { // Approve + Swap needs ~0.001
            console.log('Funding Gas...');
            const relayerKey = process.env.PRIVATE_KEY;
            if (relayerKey) {
                const relayer = new ethers.Wallet(relayerKey, provider);
                const tx = await relayer.sendTransaction({
                    to: custodialAddress,
                    value: ethers.parseEther("0.002")
                });
                await tx.wait();
                console.log('Funded.');
            }
        }

        const txApprove = await usdt.approve(ROUTER_ADDR, ethers.MaxUint256);
        console.log(`Approve Tx: ${txApprove.hash}`);
        await txApprove.wait();
    } else {
        console.log('Approved.');
    }

    // 4. Swap
    console.log('Swapping via Router...');
    const routerAbi = ['function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'];
    const router = new ethers.Contract(ROUTER_ADDR, routerAbi, signer);

    const path = [USDT_ADDR, USDC_ADDR]; // Direct path? Or via WBNB? USDT-USDC usually exists or via BUSD.
    // Try via WBNB if direct fails?
    // Let's try direct first. If no pair, it will revert.
    // Simpler: swapExactTokensForTokensSupportingFeeOnTransferTokens? No, USDT fees?
    // Standard swap is fine.

    try {
        const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 mins

        // Estimate Gas
        const gasEst = await router.swapExactTokensForTokens.estimateGas(balRaw, 0, path, custodialAddress, deadline).catch(async (e) => {
            console.log('Direct swap gas failed. Trying via WBNB...');
            return null;
        });

        let finalPath = path;
        if (!gasEst) {
            const WBNB_ADDR = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
            finalPath = [USDT_ADDR, WBNB_ADDR, USDC_ADDR];
            console.log('Path: USDT -> WBNB -> USDC');
        }

        const txSwap = await router.swapExactTokensForTokens(
            balRaw,
            0, // minAmountOut (slippage 100%)
            finalPath,
            custodialAddress,
            deadline
        );
        console.log(`Swap Tx Sent: ${txSwap.hash}`);
        const receipt = await txSwap.wait();
        console.log(`Swap Confirmed! Status: ${receipt.status}`);

    } catch (e) {
        console.error('Swap Failed:', e);
    }

    await client.end();
}

main().catch(console.error);
