/**
 * recover-custodial.ts
 * 
 * Transfers 3535 USDC from the platform custodial wallet (0xd0A115...)
 * back to the user's real wallet (0x42501490...).
 *
 * Usage:
 *   npx ts-node scripts/recover-custodial.ts
 */

import 'dotenv/config';
import { ethers } from 'ethers';
import { Pool } from 'pg';
import crypto from 'crypto';

const CUSTODIAL_ADDRESS = '0xd0A115Ea64B59F951B70276fCb65b4946465e3a9';
const DESTINATION = '0x42501490f7c291b4B28110900c9Bd81f3B35B849'; // MY_WALLET
const USDC_ADDR = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const RPC_URL = process.env.RPC_URL || 'https://bsc-dataseed.binance.org/';

// Decryption (matches EncryptionService.decrypt in src/services/encryption.ts)
function decrypt(encryptedData: string): string {
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    const textParts = encryptedData.split(':');
    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedText = Buffer.from(textParts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
    return decrypted.toString();
}

async function main() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

    // 1. Find the custodial wallet in the DB
    const res = await pool.query(
        `SELECT w.public_address, w.encrypted_private_key, u.id, u.privy_user_id 
         FROM wallets w 
         JOIN users u ON w.user_id = u.id 
         WHERE LOWER(w.public_address) = LOWER($1)`,
        [CUSTODIAL_ADDRESS]
    );

    if (res.rows.length === 0) {
        console.error('❌ Custodial wallet not found in DB');
        process.exit(1);
    }

    const row = res.rows[0];
    console.log(`✅ Found custodial wallet for user ${row.id} (Privy: ${row.privy_user_id})`);

    // 2. Decrypt private key
    const privateKey = decrypt(row.encrypted_private_key);
    console.log(`🔑 Key decrypted successfully`);

    // 3. Set up ethers
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(privateKey, provider);

    const usdc = new ethers.Contract(USDC_ADDR, [
        'function balanceOf(address) view returns (uint256)',
        'function decimals() view returns (uint8)',
        'function transfer(address, uint256) returns (bool)',
    ], signer);

    const balance = await usdc.balanceOf(CUSTODIAL_ADDRESS);
    const decimals = Number(await usdc.decimals().catch(() => 18));
    console.log(`💰 USDC balance: ${ethers.formatUnits(balance, decimals)}`);

    if (balance === 0n) {
        console.log('⚠️  No USDC balance to transfer.');
        process.exit(0);
    }

    // 4. Check BNB for gas
    const bnbBalance = await provider.getBalance(CUSTODIAL_ADDRESS);
    console.log(`⛽ BNB balance: ${ethers.formatEther(bnbBalance)}`);

    if (bnbBalance < ethers.parseEther('0.0005')) {
        // Fund gas from relayer
        console.log('⛽ Funding gas from relayer...');
        const relayer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
        const gasTx = await relayer.sendTransaction({
            to: CUSTODIAL_ADDRESS,
            value: ethers.parseEther('0.002'),
        });
        await gasTx.wait();
        console.log(`✅ Gas funded: ${gasTx.hash}`);
    }

    // 5. Transfer USDC to destination
    console.log(`\n📤 Transferring ${ethers.formatUnits(balance, decimals)} USDC to ${DESTINATION}...`);
    const tx = await usdc.transfer(DESTINATION, balance);
    console.log(`⏳ TX sent: ${tx.hash}`);
    await tx.wait();
    console.log(`\n🎉 SUCCESS! https://bscscan.com/tx/${tx.hash}`);

    await pool.end();
}

main().catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
});
