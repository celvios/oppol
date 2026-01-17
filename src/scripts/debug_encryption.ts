
import pool from '../config/database';
import { EncryptionService } from '../services/encryption';
import fs from 'fs';

async function debugEncryption() {
    const logFile = 'debug_log.txt';
    const log = (msg: string) => {
        console.log(msg);
        fs.appendFileSync(logFile, msg + '\n');
    };

    // Clear log file
    fs.writeFileSync(logFile, '');

    try {
        log('--- Debugging Encryption ---');

        const defaultKey = '1ef5d56bb056a08019ea2f34e6540211eacfd3fff109bcf98d483da21db2b3c5';
        const activeKey = process.env.ENCRYPTION_KEY || defaultKey;
        log(`Active Key in Use: ${activeKey.substring(0, 6)}...`);

        log('\nFetching users from database...');
        const result = await pool.query('SELECT * FROM telegram_users');
        log(`Found ${result.rows.length} users.`);

        let failedCount = 0;

        for (const user of result.rows) {
            // log(`\nChecking User: ${user.username} (${user.telegram_id})`);

            try {
                EncryptionService.decrypt(user.encrypted_private_key);
                // log('✅ Decryption SUCCESS');
            } catch (error: any) {
                log(`❌ Decryption FAILED for User: ${user.username} (ID: ${user.telegram_id})`);
                log(`   Error: ${error.message}`);
                failedCount++;
            }
        }

        if (failedCount === 0) {
            log('\n✅ All users verified successfully!');
        } else {
            log(`\n❌ Found ${failedCount} users with decryption errors.`);
        }

    } catch (error) {
        log(`Debug script error: ${error}`);
    } finally {
        await pool.end();
    }
}

debugEncryption();
