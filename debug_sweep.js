
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
    console.log(`Debug Sweep for User: ${TARGET_USER_ID}`);
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

    // 4. Check USDC Balance
    const usdcAbi = ['function balanceOf(address) view returns (uint256)', 'function approve(address, uint256) returns (bool)', 'function decimals() view returns (uint8)', 'function allowance(address, address) view returns (uint256)'];
    const usdc = new ethers.Contract(USDC_ADDR, usdcAbi, signer);

    const balRaw = await usdc.balanceOf(custodialAddress); // BigInt
    const decimals = await usdc.decimals().catch(() => 18); // 18? USDC is 18 on BSC? Checked before, maybe 18.
    // Wait, previous file says 6 for USDC on BSC in one place, 18 in another.
    // The contract call `decimals()` is safest.
    const bal = ethers.formatUnits(balRaw, decimals);
    console.log(`USDC Balance: ${bal} (Decimals: ${decimals})`);

    // Threshold: 0.01 USDC
    if (balRaw < ethers.parseUnits("0.01", decimals)) {
        console.log('Balance too low to sweep.');
        return;
    }

    // 5. Approve Market
    console.log('Approving Market...');
    const allowance = await usdc.allowance(custodialAddress, MARKET_ADDR);
    if (allowance < balRaw) {
        // Need BNB for gas
        const bnbBal = await provider.getBalance(custodialAddress);
        if (bnbBal < ethers.parseEther("0.0005")) {
            console.log('Funding Gas for Approve/Deposit...');
            const relayerKey = process.env.PRIVATE_KEY;
            if (relayerKey) {
                const relayer = new ethers.Wallet(relayerKey, provider);
                const tx = await relayer.sendTransaction({
                    to: custodialAddress,
                    value: ethers.parseEther("0.001")
                });
                await tx.wait();
                console.log('Gas Funded.');
            }
        }

        const txApprove = await usdc.approve(MARKET_ADDR, ethers.MaxUint256);
        console.log(`Approve Tx: ${txApprove.hash}`);
        await txApprove.wait();
        console.log('Approved.');
    } else {
        console.log('Already approved.');
    }

    // 6. Deposit to Market
    console.log('Depositing to Market...');
    const marketAbi = ['function deposit(uint256 amount)'];
    const market = new ethers.Contract(MARKET_ADDR, marketAbi, signer);

    try {
        const txDeposit = await market.deposit(balRaw);
        console.log(`Deposit Tx Sent: ${txDeposit.hash}`);
        const receipt = await txDeposit.wait();
        console.log('Deposit Confirmed!', receipt.blockNumber);
    } catch (e) {
        console.error('Deposit Failed:', e);
    }

    await client.end();
}

main().catch(console.error);
