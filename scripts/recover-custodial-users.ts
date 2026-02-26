/**
 * CUSTODIAL USER RECOVERY — Old Market Fund Rescue
 *
 * Decrypts each custodial user's private key from the DB,
 * derives their Smart Account address via Pimlico,
 * checks their balance on the OLD market,
 * and executes a gasless UserOp to withdraw → re-deposit into NEW market.
 *
 * Run: npx ts-node --project tsconfig.json scripts/recover-custodial-users.ts
 *
 * Required env vars (already in .env):
 *   DATABASE_URL, ENCRYPTION_KEY, BNB_RPC_URL,
 *   NEXT_PUBLIC_PIMLICO_API_KEY, NEXT_PUBLIC_MARKET_ADDRESS
 *
 * ⚠️  WALLET USER REMINDER: Wallet users need recover-wallet-user.ts (with their own RESCUE_KEY)
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { ethers } from 'ethers';
import { Pool } from 'pg';
import crypto from 'crypto';
import {
    createPublicClient,
    createWalletClient,
    http,
    encodeFunctionData,
    parseAbi,
} from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createSmartAccountClient } from 'permissionless';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { entryPoint07Address } from 'viem/account-abstraction';

const OLD_MARKET = '0xe5a5320b3764Bd8FFFd95cF7aA7F406DaC2B070C' as const;
const NEW_MARKET = process.env.NEXT_PUBLIC_MARKET_ADDRESS! as `0x${string}`;
const USDC = process.env.NEXT_PUBLIC_USDC_CONTRACT! as `0x${string}`;
const RPC_URL = process.env.BNB_RPC_URL!;
const PIMLICO_KEY = process.env.NEXT_PUBLIC_PIMLICO_API_KEY!;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

// ── Decryption (matches EncryptionService) ──────────────────────────────────
function decrypt(encryptedData: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// ── ABIs ────────────────────────────────────────────────────────────────────
const OLD_ABI = parseAbi([
    'function userBalances(address) view returns (uint256)',
    'function withdraw(uint256 amount) external',
]);
const NEW_ABI = parseAbi([
    'function deposit(uint256 amount) external',
]);
const ERC20_ABI = parseAbi([
    'function approve(address,uint256) returns (bool)',
]);

async function recoverForUser(
    privKeyHex: string,
    provider: ethers.JsonRpcProvider,
) {
    const formattedKey = privKeyHex.startsWith('0x')
        ? privKeyHex as `0x${string}`
        : `0x${privKeyHex}` as `0x${string}`;

    const account = privateKeyToAccount(formattedKey);
    const publicClient = createPublicClient({ chain: bsc, transport: http(RPC_URL) });

    const smartAccount = await toSimpleSmartAccount({
        client: publicClient,
        owner: account,
        entryPoint: { address: entryPoint07Address, version: '0.7' },
    });
    const saAddress = smartAccount.address;

    // Check balance on old market
    const oldMkt = new ethers.Contract(OLD_MARKET, [
        'function userBalances(address) view returns (uint256)',
    ], provider);
    const stuck: bigint = await oldMkt.userBalances(saAddress);

    if (stuck === 0n) {
        return { saAddress, stuck: 0n, status: 'no_funds' };
    }

    console.log(`  SA: ${saAddress} — stuck: ${ethers.formatUnits(stuck, 18)} USDC`);

    const pimlicoUrl = `https://api.pimlico.io/v2/56/rpc?apikey=${PIMLICO_KEY}`;
    const pimlicoClient = createPimlicoClient({
        transport: http(pimlicoUrl),
        entryPoint: { address: entryPoint07Address, version: '0.7' },
    });

    const smartAccountClient = createSmartAccountClient({
        account: smartAccount,
        chain: bsc,
        bundlerTransport: http(pimlicoUrl),
        paymaster: pimlicoClient,
        userOperation: {
            estimateFeesPerGas: async () =>
                (await pimlicoClient.getUserOperationGasPrice()).fast,
        },
    });

    // Batch: withdraw from old → approve → deposit into new
    const withdrawData = encodeFunctionData({ abi: OLD_ABI, functionName: 'withdraw', args: [stuck] });
    const approveData = encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [NEW_MARKET, stuck] });
    const depositData = encodeFunctionData({ abi: NEW_ABI, functionName: 'deposit', args: [stuck] });

    const txHash = await smartAccountClient.sendTransaction({
        calls: [
            { to: OLD_MARKET, data: withdrawData },
            { to: USDC, data: approveData },
            { to: NEW_MARKET, data: depositData },
        ],
    });

    return { saAddress, stuck, txHash, status: 'recovered' };
}

async function main() {
    console.log('\n━━━ CUSTODIAL USER RECOVERY ━━━');
    console.log('Old Market: ', OLD_MARKET);
    console.log('New Market: ', NEW_MARKET);

    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const { rows } = await pool.query(
        `SELECT w.public_address, w.encrypted_private_key, u.privy_user_id
         FROM wallets w
         JOIN users u ON u.id = w.user_id
         WHERE w.encrypted_private_key IS NOT NULL AND w.encrypted_private_key != ''
         ORDER BY w.id`
    );
    await pool.end();

    console.log(`\nFound ${rows.length} custodial wallets in DB\n`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    let totalRecovered = 0n;
    let successCount = 0;
    let skipped = 0;

    for (const row of rows) {
        try {
            const privateKey = decrypt(row.encrypted_private_key);
            const result = await recoverForUser(privateKey, provider);

            if (result.status === 'no_funds') {
                skipped++;
                continue;
            }

            if (result.status === 'recovered') {
                totalRecovered += result.stuck ?? 0n;
                successCount++;
                console.log(`  ✅ Recovered ${ethers.formatUnits(result.stuck ?? 0n, 18)} for SA ${result.saAddress} | TX: ${result.txHash}`);
            }
        } catch (e: any) {
            console.error(`  ❌ ${row.public_address}: ${e.message?.slice(0, 120)}`);
        }
    }

    console.log('\n━━━ SUMMARY ━━━');
    console.log(`Recovered: ${successCount} users, ${ethers.formatUnits(totalRecovered, 18)} USDC`);
    console.log(`Skipped (no balance): ${skipped}`);

    console.log('\n⚠️  REMINDER: Also run recover-wallet-user.ts for each wallet user with RESCUE_KEY set to their private key!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);
