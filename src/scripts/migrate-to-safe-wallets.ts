/**
 * Phase 3 Migration Script: Simple SA → Safe Proxy Wallet
 *
 * Self-contained script (no walletController import) that:
 *   1. Loads every custodial user from the DB
 *   2. Derives their OLD SimpleSmartAccount address
 *   3. Derives their NEW SafeSmartAccount address (deterministic via userId salt)
 *   4. Reads USDC balances on the old address
 *   5. [DRY RUN] Prints a full report — no funds moved
 *   6. [LIVE]    Sweeps USDC old→new via a UserOperation
 *   7. [LIVE]    Updates users.wallet_address → new Safe address
 *   8. [LIVE]    Re-points trades.user_address old→new so portfolio history stays intact
 *
 * Usage:
 *   npx ts-node src/scripts/migrate-to-safe-wallets.ts --dry-run
 *   npx ts-node src/scripts/migrate-to-safe-wallets.ts --live
 *   npx ts-node src/scripts/migrate-to-safe-wallets.ts --live --userId=<db-uuid>
 */

import dotenv from 'dotenv';
dotenv.config();

import { ethers } from 'ethers';
import {
    createPublicClient,
    http,
    encodeFunctionData,
    parseAbi,
    keccak256,
    toBytes,
    type PublicClient,
} from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createSmartAccountClient } from 'permissionless';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { toSimpleSmartAccount, toSafeSmartAccount } from 'permissionless/accounts';
import { entryPoint07Address } from 'viem/account-abstraction';
import { query } from '../config/database';
import { EncryptionService } from '../services/encryption';

// ── Config ────────────────────────────────────────────────────────────────────
const IS_DRY_RUN = !process.argv.includes('--live');
const SINGLE_USER = (() => { const f = process.argv.find(a => a.startsWith('--userId=')); return f ? f.split('=')[1] : null; })();
const RPC_URL = process.env.BNB_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed.binance.org';
const USDC_ADDR = (process.env.NEXT_PUBLIC_USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d') as `0x${string}`;
const MARKET_ADDR = (process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MARKET_CONTRACT || '') as `0x${string}`;
const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID || '56';
const PIMLICO_KEY = process.env.PIMLICO_API_KEY || process.env.NEXT_PUBLIC_PIMLICO_API_KEY || '';
const BUNDLER_URL = `https://api.pimlico.io/v2/${CHAIN_ID}/rpc?apikey=${PIMLICO_KEY}`;
const USDC_DECIMALS = 18;

const USDC_ABI = parseAbi(['function balanceOf(address) view returns (uint256)', 'function transfer(address to, uint256 amount) returns (bool)']);
const MARKET_ABI = parseAbi(['function balanceOf(address) view returns (uint256)', 'function withdraw(uint256 amount)']);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function deriveSimpleSA(privateKeyHex: string, publicClient: PublicClient): Promise<string> {
    const key = (privateKeyHex.startsWith('0x') ? privateKeyHex : `0x${privateKeyHex}`) as `0x${string}`;
    const owner = privateKeyToAccount(key);
    const acct = await toSimpleSmartAccount({ client: publicClient as any, owner, entryPoint: { address: entryPoint07Address, version: '0.7' } });
    return acct.address;
}

async function deriveSafeSA(privateKeyHex: string, userId: string, publicClient: PublicClient): Promise<string> {
    const key = (privateKeyHex.startsWith('0x') ? privateKeyHex : `0x${privateKeyHex}`) as `0x${string}`;
    const owner = privateKeyToAccount(key);
    // Deterministic saltNonce: first 8 bytes of keccak256(userId) → stable bigint per user
    const saltNonce = BigInt('0x' + keccak256(toBytes(userId)).slice(2, 18));
    const acct = await toSafeSmartAccount({
        client: publicClient as any,
        owners: [owner],
        version: '1.4.1',
        entryPoint: { address: entryPoint07Address, version: '0.7' },
        saltNonce,
    });
    return acct.address;
}

async function readUSDC(addr: string, publicClient: PublicClient): Promise<bigint> {
    try {
        return await publicClient.readContract({ address: USDC_ADDR, abi: USDC_ABI, functionName: 'balanceOf', args: [addr as `0x${string}`] }) as bigint;
    } catch { return 0n; }
}

async function readMarket(addr: string, publicClient: PublicClient): Promise<bigint> {
    if (!MARKET_ADDR) return 0n;
    try {
        return await publicClient.readContract({ address: MARKET_ADDR, abi: MARKET_ABI, functionName: 'balanceOf', args: [addr as `0x${string}`] }) as bigint;
    } catch { return 0n; }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(` Phase 3 Migration — ${IS_DRY_RUN ? '🔍 DRY RUN (no funds moved)' : '🚀 LIVE MIGRATION'}`);
    if (SINGLE_USER) console.log(` Single-user mode: ${SINGLE_USER}`);
    console.log(`${'─'.repeat(60)}\n`);

    const publicClient = createPublicClient({ chain: bsc, transport: http(RPC_URL) }) as PublicClient;

    const params = SINGLE_USER ? [SINGLE_USER] : [];
    const where = SINGLE_USER ? 'AND u.id = $1' : '';
    const result = await query(
        `SELECT u.id, u.wallet_address, u.privy_user_id, w.encrypted_private_key
         FROM users u JOIN wallets w ON w.user_id = u.id
         WHERE w.encrypted_private_key IS NOT NULL ${where}
         ORDER BY u.created_at ASC`,
        params,
    );

    const users = result.rows;
    console.log(`Found ${users.length} custodial user(s).\n`);

    let migrated = 0, skipped = 0, errors = 0;

    for (const user of users) {
        console.log(`\nUser: ${user.id}  (${user.privy_user_id || 'no privy id'})`);

        // 1. Decrypt key
        let pk: string;
        try { pk = EncryptionService.decrypt(user.encrypted_private_key); }
        catch (e: any) { console.error(`  ❌ Decrypt failed: ${e.message}`); errors++; continue; }

        // 2. Derive old & new addresses
        let oldAddr: string, newAddr: string;
        try {
            [oldAddr, newAddr] = await Promise.all([
                deriveSimpleSA(pk, publicClient),
                deriveSafeSA(pk, user.id, publicClient),
            ]);
        } catch (e: any) { console.error(`  ❌ Derivation failed: ${e.message}`); errors++; continue; }

        if (oldAddr.toLowerCase() === newAddr.toLowerCase()) {
            console.warn(`  ⚠️  Addresses identical — may already be on Safe. Skipping.`);
            skipped++; continue;
        }

        // 3. Read balances
        const [walletBal, marketBal] = await Promise.all([
            readUSDC(oldAddr, publicClient),
            readMarket(oldAddr, publicClient),
        ]);
        const totalBal = walletBal + marketBal;

        console.log(`  Old SA  : ${oldAddr}`);
        console.log(`  New Safe: ${newAddr}`);
        console.log(`  Wallet  : ${ethers.formatUnits(walletBal, USDC_DECIMALS)} USDC`);
        console.log(`  Market  : ${ethers.formatUnits(marketBal, USDC_DECIMALS)} USDC`);
        console.log(`  Total   : ${ethers.formatUnits(totalBal, USDC_DECIMALS)} USDC`);
        const dbMatch = user.wallet_address?.toLowerCase() === oldAddr.toLowerCase();
        console.log(`  DB addr : ${user.wallet_address} ${dbMatch ? '✅' : '⚠️  mismatch'}`);

        if (IS_DRY_RUN) {
            // Show how many trade rows would be re-pointed
            let tradeCount = 0;
            try {
                const tr = await query(
                    `SELECT COUNT(*) AS cnt FROM trades WHERE LOWER(user_address) = $1`,
                    [oldAddr.toLowerCase()],
                );
                tradeCount = parseInt(tr.rows[0]?.cnt || '0');
            } catch { /* ignore if trades table doesn't exist yet */ }
            console.log(`  → [DRY RUN] Would sweep ${ethers.formatUnits(totalBal, USDC_DECIMALS)} USDC → ${newAddr}`);
            console.log(`  → [DRY RUN] Would re-point ${tradeCount} trade row(s) to new address`);
            continue;
        }

        // ── LIVE MODE ───────────────────────────────────────────────────────
        if (totalBal === 0n) {
            console.log(`  → No balance. Updating DB address + trades only.`);
            await query('UPDATE users SET wallet_address = $1 WHERE id = $2', [newAddr, user.id]);
            // Still re-point any historical trades even if no funds to sweep
            const { rowCount } = await query(
                `UPDATE trades SET user_address = $1 WHERE LOWER(user_address) = $2`,
                [newAddr.toLowerCase(), oldAddr.toLowerCase()],
            );
            console.log(`  ✅ Re-pointed ${rowCount ?? 0} trade row(s) to new address`);
            skipped++; continue;
        }

        try {
            // Build Simple SA client (the OLD account does the sweeping)
            const key = (pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`;
            const owner = privateKeyToAccount(key);
            const simpleAcct = await toSimpleSmartAccount({ client: publicClient as any, owner, entryPoint: { address: entryPoint07Address, version: '0.7' } });
            const pimlico = createPimlicoClient({ transport: http(BUNDLER_URL), entryPoint: { address: entryPoint07Address, version: '0.7' } });
            const oldClient = createSmartAccountClient({
                account: simpleAcct, chain: bsc, bundlerTransport: http(BUNDLER_URL), paymaster: pimlico,
                userOperation: { estimateFeesPerGas: async () => (await pimlico.getUserOperationGasPrice()).fast },
            });

            const calls: { to: `0x${string}`; data: `0x${string}` }[] = [];

            // Withdraw from market if needed
            if (marketBal > 0n && MARKET_ADDR) {
                calls.push({
                    to: MARKET_ADDR,
                    data: encodeFunctionData({ abi: MARKET_ABI, functionName: 'withdraw', args: [marketBal] }),
                });
            }

            // Transfer all USDC to new Safe address
            calls.push({
                to: USDC_ADDR,
                data: encodeFunctionData({ abi: USDC_ABI, functionName: 'transfer', args: [newAddr as `0x${string}`, totalBal] }),
            });

            console.log(`  → Sending ${calls.length}-call UserOperation...`);
            const userOpHash = await oldClient.sendUserOperation({ calls });
            const receipt = await pimlico.waitForUserOperationReceipt({ hash: userOpHash });
            console.log(`  ✅ Swept! Tx: ${receipt.receipt.transactionHash}`);

            // Update users.wallet_address
            await query('UPDATE users SET wallet_address = $1 WHERE id = $2', [newAddr, user.id]);
            console.log(`  ✅ DB updated → ${newAddr}`);

            // Re-point trade history: old SA → new Safe address
            // This ensures the portfolio page shows pre-migration trades under the new address.
            const { rowCount } = await query(
                `UPDATE trades SET user_address = $1 WHERE LOWER(user_address) = $2`,
                [newAddr.toLowerCase(), oldAddr.toLowerCase()],
            );
            console.log(`  ✅ Re-pointed ${rowCount ?? 0} trade row(s) to new address`);
            migrated++;

        } catch (e: any) {
            console.error(`  ❌ Migration FAILED: ${e.message}`);
            errors++;
        }
    }

    console.log(`\n${'─'.repeat(60)}`);
    console.log(` Summary: migrated=${migrated}  skipped=${skipped}  errors=${errors}`);
    console.log(`${'─'.repeat(60)}\n`);
    if (IS_DRY_RUN) console.log('Run with --live when ready.\n');
    if (!IS_DRY_RUN && errors > 0) console.log(`⚠️  Re-run --live to retry ${errors} failed user(s).\n`);
    process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
