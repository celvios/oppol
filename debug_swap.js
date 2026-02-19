
const { Client } = require('pg');
const { ethers } = require('ethers');
const crypto = require('crypto');
require('dotenv').config();

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org/';
const USDT_ADDR = process.env.NEXT_PUBLIC_USDT_CONTRACT || '0x55d398326f99059fF775485246999027B3197955';
const ZAP_ADDR = process.env.NEXT_PUBLIC_ZAP_ADDRESS || '0x946e136ef0680709f77d60cd7d750c3f32e08e20';
// Funds Detected User ID from previous step
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
    console.log(`Debug Swap for User: ${TARGET_USER_ID}`);
    const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();

    // 1. Get Wallet
    const res = await client.query('SELECT public_address, encrypted_private_key FROM wallets WHERE user_id = $1', [TARGET_USER_ID]);
    if (res.rows.length === 0) { console.error('User not found'); return; }

    const wallet = res.rows[0];
    const custodialAddress = wallet.public_address;
    console.log(`Custodial Address: ${custodialAddress}`);

    // 2. Decrypt Param
    const privateKey = decrypt(wallet.encrypted_private_key);
    console.log(`Private Key Decrypted: ${privateKey.slice(0, 6)}...`);

    // 3. Setup Ethers
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(privateKey, provider);

    // 4. Check Balances
    const usdtAbi = ['function balanceOf(address) view returns (uint256)', 'function approve(address, uint256) returns (bool)', 'function decimals() view returns (uint8)', 'function allowance(address, address) view returns (uint256)'];
    const usdt = new ethers.Contract(USDT_ADDR, usdtAbi, signer);

    const balRaw = await usdt.balanceOf(custodialAddress);
    const decimals = await usdt.decimals().catch(() => 18);
    const bal = ethers.formatUnits(balRaw, decimals);
    console.log(`USDT Balance: ${bal}`);

    if (parseFloat(bal) < 0.1) {
        console.log('Balance too low to swap.');
        return;
    }

    const bnbBal = await provider.getBalance(custodialAddress);
    console.log(`BNB Balance: ${ethers.formatEther(bnbBal)}`);

    // Fund Gas if needed
    if (bnbBal < ethers.parseEther("0.001")) {
        console.log('Low Gas. Attempting to fund from Relayer (env)...');
        const relayerKey = process.env.PRIVATE_KEY;
        if (relayerKey) {
            const relayer = new ethers.Wallet(relayerKey, provider);
            const tx = await relayer.sendTransaction({
                to: custodialAddress,
                value: ethers.parseEther("0.002")
            });
            await tx.wait();
            console.log('Gas Funded!', tx.hash);
        } else {
            console.error('No Relayer Key in env!');
        }
    }

    // 5. Execute Swap
    console.log('Approving Zap...');
    const zapAbi = ['function zapInToken(address tokenIn, uint256 amountIn, uint256 minUSDC) external'];
    const zap = new ethers.Contract(ZAP_ADDR, zapAbi, signer);

    const allowance = await usdt.allowance(custodialAddress, ZAP_ADDR);
    if (allowance < balRaw) {
        const txApprove = await usdt.approve(ZAP_ADDR, balRaw);
        console.log(`Approve Tx detected: ${txApprove.hash}. Waiting...`);
        await txApprove.wait();
        console.log('Approved.');
    } else {
        console.log('Already approved.');
    }

    console.log('Zapping...');
    try {
        // Estimate Gas first to fail fast
        const gasEst = await zap.zapInToken.estimateGas(USDT_ADDR, balRaw, 0);
        console.log(`Gas Estimate: ${gasEst.toString()}`);

        const txZap = await zap.zapInToken(USDT_ADDR, balRaw, 0);
        console.log(`Zap Tx Sent: ${txZap.hash}`);
        const receipt = await txZap.wait();
        console.log('Zap Confirmed!', receipt.blockNumber);
    } catch (e) {
        console.error('Zap Failed:', e);
        if (e.data) {
            console.error('Revert Data:', e.data);
            // Try to decode?
        }
    }

    await client.end();
}

main().catch(console.error);
