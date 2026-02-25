/**
 * recover-sa-usdc.ts
 *
 * One-time script to recover USDC stuck in a user's Pimlico Smart Account (SA)
 * and transfer it back to their custodial EOA wallet.
 *
 * Usage:
 *   npx ts-node src/scripts/recover-sa-usdc.ts <userId_or_privyUserId>
 *
 * The SA was shown as the deposit address after an incorrect fix.
 * Funds sent to the SA need to be returned to the EOA so multi-bet can use them.
 */

import dotenv from 'dotenv';
dotenv.config();

import { ethers } from 'ethers';
import { createPublicClient, http, encodeFunctionData, parseAbi } from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createSmartAccountClient } from 'permissionless';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { entryPoint07Address } from 'viem/account-abstraction';
import { query } from '../config/database';
import { EncryptionService } from '../services/encryption';

const CONFIG_RPC = process.env.BNB_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-rpc.publicnode.com';
const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d') as `0x${string}`;
const PIMLICO_KEY = process.env.NEXT_PUBLIC_PIMLICO_API_KEY || process.env.PIMLICO_API_KEY || '';
const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID || '56';
const PIMLICO_URL = `https://api.pimlico.io/v2/${CHAIN_ID}/rpc?apikey=${PIMLICO_KEY}`;

async function recoverSaFunds(userId: string) {
    console.log(`\n🔍 Looking up custodial wallet for user: ${userId}`);

    // Look up user by ID or Privy ID
    let walletResult = await query(
        `SELECT w.public_address, w.encrypted_private_key
         FROM wallets w
         JOIN users u ON u.id = w.user_id
         WHERE u.id = $1 OR u.privy_user_id = $1`,
        [userId]
    );

    if (walletResult.rows.length === 0) {
        console.error(`❌ No wallet found for user: ${userId}`);
        process.exit(1);
    }

    const { public_address: eoa, encrypted_private_key } = walletResult.rows[0];
    console.log(`✅ EOA address: ${eoa}`);

    // Decrypt private key
    const privateKey = EncryptionService.decrypt(encrypted_private_key);
    const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;

    // Derive SA address
    const publicClient = createPublicClient({ chain: bsc, transport: http(CONFIG_RPC) });
    const ownerAccount = privateKeyToAccount(formattedKey);
    const smartAccount = await toSimpleSmartAccount({
        client: publicClient,
        owner: ownerAccount,
        entryPoint: { address: entryPoint07Address, version: "0.7" },
    });
    const saAddress = smartAccount.address;
    console.log(`✅ SA  address: ${saAddress}`);

    // Check SA USDC balance
    const provider = new ethers.JsonRpcProvider(CONFIG_RPC);
    const usdc = new ethers.Contract(USDC_ADDRESS, [
        'function balanceOf(address) view returns (uint256)',
        'function decimals() view returns (uint8)'
    ], provider);

    const [rawBal, decimals] = await Promise.all([usdc.balanceOf(saAddress), usdc.decimals()]);
    const balance = parseFloat(ethers.formatUnits(rawBal, decimals));
    console.log(`💰 SA USDC balance: ${balance} USDC`);

    if (rawBal === 0n || balance < 0.001) {
        console.log('ℹ️  SA has no meaningful USDC balance. Nothing to recover.');
        process.exit(0);
    }

    console.log(`\n📤 Transferring ${balance} USDC from SA → EOA via Pimlico...`);

    // Build Pimlico SA client
    const pimlicoClient = createPimlicoClient({
        transport: http(PIMLICO_URL),
        entryPoint: { address: entryPoint07Address, version: "0.7" },
    });

    const smartAccountClient = createSmartAccountClient({
        account: smartAccount,
        chain: bsc,
        bundlerTransport: http(PIMLICO_URL),
        paymaster: pimlicoClient,
        userOperation: {
            estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
        },
    });

    // SA transfers USDC to EOA
    const transferData = encodeFunctionData({
        abi: parseAbi(['function transfer(address to, uint256 amount) returns (bool)']),
        functionName: 'transfer',
        args: [eoa as `0x${string}`, rawBal],
    });

    const userOpHash = await smartAccountClient.sendUserOperation({
        calls: [{ to: USDC_ADDRESS, data: transferData }],
    });

    console.log(`⏳ UserOp submitted: ${userOpHash}`);
    const receipt = await pimlicoClient.waitForUserOperationReceipt({ hash: userOpHash });
    console.log(`\n✅ Recovery complete! TX: ${receipt.receipt.transactionHash}`);
    console.log(`   ${balance} USDC is now back in EOA: ${eoa}`);
    console.log(`\n   The user can now place a bet and the auto-deposit will handle the rest.`);
}

const userId = process.argv[2];
if (!userId) {
    console.error('Usage: npx ts-node src/scripts/recover-sa-usdc.ts <userId_or_privyUserId>');
    process.exit(1);
}

recoverSaFunds(userId).catch(e => {
    console.error('❌ Recovery failed:', e.message);
    process.exit(1);
});
