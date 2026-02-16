
import pool from '../config/database';
import { EncryptionService } from '../services/encryption';
import { CustodialWalletService } from '../services/custodialWallet';
import { ethers } from 'ethers';
import fs from 'fs';

import { CONFIG } from '../config/contracts';
import dotenv from 'dotenv';
dotenv.config();

const RPC_URL = CONFIG.RPC_URL || 'https://bsc-dataseed.binance.org';
const USDC_ADDRESS = CONFIG.USDC_CONTRACT;

const USDC_ABI = [
    'function balanceOf(address account) external view returns (uint256)'
];

async function debugBetFlow() {
    const logFile = 'debug_bet_log.txt';
    const log = (msg: string) => {
        console.log(msg);
        fs.appendFileSync(logFile, msg + '\n');
    };
    fs.writeFileSync(logFile, '');

    const TELEGRAM_ID = '1034989511'; // Kpatech_1

    try {
        log('--- Debugging Bet Flow ---');
        log(`Creating provider for: ${RPC_URL}`);
        const provider = new ethers.JsonRpcProvider(RPC_URL);

        // 1. Fetch User
        log(`Fetching user: ${TELEGRAM_ID}...`);
        const result = await pool.query('SELECT * FROM telegram_users WHERE telegram_id = $1', [TELEGRAM_ID]);

        if (result.rows.length === 0) {
            log('❌ User not found in DB!');
            return;
        }

        const user = result.rows[0];
        log(`User found: ${user.username}`);
        log(`Wallet: ${user.wallet_address}`);
        log(`Encrypted Key: ${user.encrypted_private_key.substring(0, 20)}...`);

        // 2. Try Decrypt
        let privateKey: string;
        try {
            log(`Full Encrypted Data: ${user.encrypted_private_key}`);
            log('Attempting decryption with standard service...');
            privateKey = EncryptionService.decrypt(user.encrypted_private_key);
            log('✅ Decryption SUCCESS (Key is valid)');
        } catch (e: any) {
            log(`⚠️ Decryption FAILED: ${e.message}`);

            // DIAGNOSTICS
            const currentEnvKey = process.env.ENCRYPTION_KEY;
            log(`Current ENV Key: ${currentEnvKey}`);

            const crypto = require('crypto');
            const ALGORITHM = 'aes-256-gcm';

            const tryDecrypt = (keyBuffer: Buffer, label: string) => {
                try {
                    const parts = user.encrypted_private_key.split(':');
                    const iv = Buffer.from(parts[0], 'hex');
                    const authTag = Buffer.from(parts[1], 'hex');
                    const encrypted = parts[2];
                    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
                    decipher.setAuthTag(authTag);
                    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
                    decrypted += decipher.final('utf8');
                    log(`✅ SUCCESS with ${label}`);
                    return true;
                } catch (err) {
                    log(`❌ FAILED with ${label}`);
                    return false;
                }
            };

            if (currentEnvKey) {
                // Try UTF8 direct (if length 32)
                if (currentEnvKey.length === 32) {
                    tryDecrypt(Buffer.from(currentEnvKey, 'utf8'), 'UTF8 Direct');
                }
                // Try truncated to 32 bytes (UTF8)
                const truncatedKey = currentEnvKey.substring(0, 32);
                tryDecrypt(Buffer.from(truncatedKey, 'utf8'), 'UTF8 Truncated (32 chars)');

                // Try SHA256
                const sha256Key = crypto.createHash('sha256').update(currentEnvKey).digest();
                tryDecrypt(sha256Key, 'SHA256 Hash');

                // Try as simple Buffer (might be truncated/padded)
                const buf = Buffer.alloc(32);
                buf.write(currentEnvKey);
                tryDecrypt(buf, 'Buffer Write (Truncated/Padded)');
            }

            log('--- Starting Auto-Heal Simulation ---');
            // ... rest of auto-heal ...

            try {
                if (user.wallet_address) {
                    log('Checking wallet balance via RPC...');
                    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
                    // Add timeout or catch specifically for RPC
                    const balance = await usdcContract.balanceOf(user.wallet_address);
                    log(`RPC Balance Check: ${ethers.formatUnits(balance, 6)} USDC`);

                    if (balance > BigInt(100000)) {
                        log('❌ Auto-Heal BLOCKED: User has funds.');
                        throw new Error('HAS_FUNDS');
                    }
                }

                log('Regenerating Wallet...');
                const newWallet = await CustodialWalletService.createWallet(TELEGRAM_ID);
                log(`✅ New Wallet Generated: ${newWallet.address}`);

                // Don't actually update DB in debug script unless we want to fix it now
                // But if we are here, it means the previous fix didn't work or key is bad again.
                // Let's actually UPDATE it if we are confident, to fix the user's issue.

                // Uncomment to fix real DB:
                // await pool.query('UPDATE telegram_users ...');
                log('(Skipping DB update in debug mode)');

            } catch (healError: any) {
                log(`❌ Auto-Heal FAILED: ${healError.message}`);
                if (healError.code === 'NETWORK_ERROR' || healError.message.includes('timeout')) {
                    log('👉 DIAGNOSIS: RPC Connection Error preventing healing.');
                }
            }
            return;
        }

        // 3. If Decrypt Worked, Check Gas/Balance logic
        log('--- Checking Post-Auth Logic ---');
        const wallet = new ethers.Wallet(privateKey, provider);

        const serverPrivateKey = process.env.PRIVATE_KEY;
        if (!serverPrivateKey) {
            log('❌ Server PRIVATE_KEY missing in env!');
            return;
        }

        try {
            const operatorWallet = new ethers.Wallet(serverPrivateKey, provider);
            log('Checking Operator Gas...');
            const opBalance = await provider.getBalance(operatorWallet.address);
            log(`Operator BNB: ${ethers.formatEther(opBalance)}`);

            if (opBalance < ethers.parseEther('0.005')) {
                log('❌ FAIL: Server Low Gas');
            } else {
                log('✅ Operator Gas OK');
            }

        } catch (opError: any) {
            log(`❌ Operator Check Failed: ${opError.message}`);
        }

    } catch (error: any) {
        log(`❌ Critical Script Error: ${error.message}`);
    } finally {
        await pool.end();
    }
}

debugBetFlow();
