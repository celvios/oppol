
const { Client } = require('pg');
const { ethers } = require('ethers');
const crypto = require('crypto');
require('dotenv').config();

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org/';
const USDC_ADDR = process.env.NEXT_PUBLIC_USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || '0xe3Eb84D7e271A5C44B27578547f69C80c497355B';

const TARGET_USER_ID = '72d68b9c-f4a4-43ed-b8a8-151c3f5c9322';
const WITHDRAW_AMOUNT = '0.05'; // Withdraw 0.05 USDC to leave some for gas/dust
const randomWallet = ethers.Wallet.createRandom();
const DEST_ADDR = randomWallet.address; // Use valid random address

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
    console.log(`Debug Withdraw for User: ${TARGET_USER_ID}`);
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

    // 2. Check Gas
    const bnbBal = await provider.getBalance(custodialAddress);
    console.log(`BNB Balance: ${ethers.formatEther(bnbBal)}`);

    if (bnbBal < ethers.parseEther("0.0006")) {
        console.log('Funding Gas...');
        const relayerKey = process.env.PRIVATE_KEY;
        if (relayerKey) {
            const relayer = new ethers.Wallet(relayerKey, provider);
            const tx = await relayer.sendTransaction({
                to: custodialAddress,
                value: ethers.parseEther("0.001")
            });
            await tx.wait();
            console.log('Funded.');
        } else {
            console.log('No Relayer Key, cannot fund.');
        }
    }

    // 3. Check Wallet USDC
    const usdcAbi = ['function balanceOf(address) view returns (uint256)', 'function transfer(address, uint256) returns (bool)', 'function decimals() view returns (uint8)'];
    const usdc = new ethers.Contract(USDC_ADDR, usdcAbi, signer);
    const decimals = await usdc.decimals().catch(() => 18);
    const walletBalRaw = await usdc.balanceOf(custodialAddress);
    const walletBal = ethers.formatUnits(walletBalRaw, decimals);
    console.log(`Wallet USDC: ${walletBal}`);

    const amountBN = ethers.parseUnits(WITHDRAW_AMOUNT, decimals); // 0.1 USDC

    // 4. Withdraw from Market if needed
    if (walletBalRaw < amountBN) {
        const needed = amountBN - walletBalRaw;
        console.log(`Need ${ethers.formatUnits(needed, decimals)} USDC from Market.`);

        const marketAbi = ['function withdraw(uint256 amount)', 'function balanceOf(address) view returns (uint256)']; // Check if market has balanceOf for shares?
        const market = new ethers.Contract(MARKET_ADDR, marketAbi, signer);

        // Try to check user's balance in market (if mapping exists)
        try {
            const marketBal = await market.balanceOf(custodialAddress); // Assuming basic ERC20 or mapping check
            console.log(`Market Balance (Shares?): ${marketBal.toString()}`);
        } catch (e) { console.log('Market balanceOf check failed or not ERC20 compliant'); }

        try {
            console.log(`Withdrawing ${ethers.formatUnits(needed, decimals)} from Market...`);
            // ESTIMATE GAS FIRST
            const gasEst = await market.withdraw.estimateGas(needed);
            console.log(`Gas Est: ${gasEst}`);

            const txWithdraw = await market.withdraw(needed);
            console.log(`Withdraw Tx: ${txWithdraw.hash}`);
            await txWithdraw.wait();
            console.log('Withdraw Confirmed.');
        } catch (e) {
            console.error('Withdraw from Market FAILED:', e);
            if (e.data) console.error('Revert Data:', e.data);
            return;
        }
    } else {
        console.log('Enough USDC in wallet. Skipping market withdraw.');
    }

    // 5. Transfer to Dest
    // Use a temp random address if DEST_ADDR is not set nicely, but 0x3B6... is fine.
    // Actually, let's just hold it in the wallet for now to verify logic, OR send to self?
    // Sending to self is redundant logic test.
    // Let's send to a dummy address to verify transfer.
    try {
        console.log(`Transferring ${WITHDRAW_AMOUNT} USDC to ${DEST_ADDR}...`);
        const txTransfer = await usdc.transfer(DEST_ADDR, amountBN);
        console.log(`Transfer Tx: ${txTransfer.hash}`);
        await txTransfer.wait();
        console.log('Transfer Successful.');
    } catch (e) {
        console.error('Transfer Failed:', e);
    }

    await client.end();
}

main().catch(console.error);
