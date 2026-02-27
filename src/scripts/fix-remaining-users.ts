/**
 * Force-update DB wallet_address for the 2 users whose Simple SA migration
 * failed due to missing Pimlico key (dust balance ~$0.003 — not worth sweeping).
 * This makes their DB point to the new Safe SA so the app uses the correct address.
 */
import dotenv from 'dotenv';
dotenv.config();
import { createPublicClient, http, keccak256, toBytes, type PublicClient } from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { toSafeSmartAccount } from 'permissionless/accounts';
import { entryPoint07Address } from 'viem/account-abstraction';
import { query } from '../config/database';
import { EncryptionService } from '../services/encryption';

const RPC = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org';

const USERS = [
    '7668bc11-05da-4b02-8b4b-2d97af51842c',
    '49aab3f1-69de-4819-abee-2b5bd18680ea',
];

async function main() {
    const publicClient = createPublicClient({ chain: bsc, transport: http(RPC) }) as PublicClient;

    const result = await query(
        `SELECT u.id, w.encrypted_private_key
         FROM users u JOIN wallets w ON w.user_id = u.id
         WHERE u.id = ANY($1::uuid[]) AND w.encrypted_private_key IS NOT NULL`,
        [USERS],
    );

    for (const user of result.rows) {
        console.log(`\nUser: ${user.id}`);
        try {
            const pk = EncryptionService.decrypt(user.encrypted_private_key);
            const key = (pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`;
            const owner = privateKeyToAccount(key);
            const saltNonce = BigInt('0x' + keccak256(toBytes(user.id)).slice(2, 18));
            const safeAcct = await toSafeSmartAccount({
                client: publicClient as any,
                owners: [owner],
                version: '1.4.1',
                entryPoint: { address: entryPoint07Address, version: '0.7' },
                saltNonce,
            });
            const newAddr = safeAcct.address;
            console.log(`  New Safe SA: ${newAddr}`);

            // Update wallet_address
            await query('UPDATE users SET wallet_address = $1 WHERE id = $2', [newAddr, user.id]);
            console.log(`  ✅ DB updated → ${newAddr}`);

            // Re-point any trades (should be 0, but just in case)
            const { rowCount } = await query(
                `UPDATE trades SET user_address = $1 WHERE LOWER(user_address) = $2`,
                [newAddr.toLowerCase(), newAddr.toLowerCase()],
            );
            console.log(`  ✅ Re-pointed ${rowCount ?? 0} trade row(s)`);

        } catch (e: any) {
            console.error(`  ❌ Failed: ${e.message}`);
        }
    }

    console.log('\nDone.');
    process.exit(0);
}
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
