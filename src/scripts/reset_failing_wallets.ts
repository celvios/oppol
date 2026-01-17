
import pool from '../config/database';
import { EncryptionService } from '../services/encryption';
import { CustodialWalletService } from '../services/custodialWallet';
import fs from 'fs';

async function fixWallets() {
    const logFile = 'fix_wallets_log.txt';
    const log = (msg: string) => {
        console.log(msg);
        fs.appendFileSync(logFile, msg + '\n');
    };
    fs.writeFileSync(logFile, '');

    try {
        log('--- Fixing Failing Wallets ---');

        const result = await pool.query('SELECT * FROM telegram_users');
        log(`Checking ${result.rows.length} users...`);

        let fixedCount = 0;

        for (const user of result.rows) {
            try {
                EncryptionService.decrypt(user.encrypted_private_key);
            } catch (error: any) {
                log(`\n❌ Fix needed for: ${user.username} (ID: ${user.telegram_id})`);

                // Create new wallet
                const newWallet = await CustodialWalletService.createWallet(user.telegram_id.toString());

                // Update DB
                await pool.query(
                    'UPDATE telegram_users SET wallet_address = $1, encrypted_private_key = $2 WHERE telegram_id = $3',
                    [newWallet.address, newWallet.encryptedPrivateKey, user.telegram_id]
                );

                log(`   ✅ Wallet reset! New address: ${newWallet.address}`);
                fixedCount++;
            }
        }

        log(`\n✅ Summary: Fixed ${fixedCount} wallets.`);

    } catch (error) {
        log(`Fix script error: ${error}`);
    } finally {
        await pool.end();
    }
}

fixWallets();
