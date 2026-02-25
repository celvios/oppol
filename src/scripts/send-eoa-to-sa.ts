import dotenv from 'dotenv';
dotenv.config();

import { ethers } from 'ethers';
import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { entryPoint07Address } from 'viem/account-abstraction';
import { query } from '../config/database';
import { EncryptionService } from '../services/encryption';

const CONFIG_RPC = process.env.BNB_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-rpc.publicnode.com';
const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d') as `0x${string}`;

async function sendEoaToSa(userId: string) {
    console.log(`\n🔍 Looking up custodial wallet for user: ${userId}`);

    let walletResult = await query(
        `SELECT w.public_address as eoa, w.encrypted_private_key
         FROM wallets w JOIN users u ON u.id = w.user_id
         WHERE u.id::text = $1 OR u.privy_user_id = $1 OR LOWER(u.wallet_address) = LOWER($1) OR LOWER(w.public_address) = LOWER($1)`,
        [userId]
    );

    if (walletResult.rows.length === 0) {
        console.error(`❌ No wallet found for user: ${userId}`);
        process.exit(1);
    }

    const { eoa, encrypted_private_key } = walletResult.rows[0];
    console.log(`✅ EOA address: ${eoa}`);

    const privateKey = EncryptionService.decrypt(encrypted_private_key);
    const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;

    // Derive SA
    const publicClient = createPublicClient({ chain: bsc, transport: http(CONFIG_RPC) });
    const ownerAccount = privateKeyToAccount(formattedKey);
    const smartAccount = await toSimpleSmartAccount({
        client: publicClient,
        owner: ownerAccount,
        entryPoint: { address: entryPoint07Address, version: "0.7" },
    });
    const saAddress = smartAccount.address;
    console.log(`✅ SA address: ${saAddress}`);

    const provider = new ethers.JsonRpcProvider(CONFIG_RPC);
    const eoaWallet = new ethers.Wallet(formattedKey, provider);

    const usdc = new ethers.Contract(USDC_ADDRESS, [
        'function balanceOf(address) view returns (uint256)',
        'function decimals() view returns (uint8)',
        'function transfer(address to, uint256 amount) returns (bool)'
    ], eoaWallet);

    const [rawBal, decimals] = await Promise.all([usdc.balanceOf(eoa), usdc.decimals()]);
    const balance = parseFloat(ethers.formatUnits(rawBal, decimals));
    console.log(`💰 EOA USDC balance: ${balance} USDC`);

    if (rawBal === 0n || balance < 0.001) {
        console.log('ℹ️  EOA has no meaningful USDC balance to send.');
        process.exit(0);
    }

    // Check BNB for gas
    const bnbBal = await provider.getBalance(eoa);
    console.log(`⛽ EOA BNB balance: ${ethers.formatEther(bnbBal)} BNB`);

    if (bnbBal < ethers.parseEther('0.0005')) {
        console.log('⚠️ EOA needs BNB for gas. Attempting to fund from admin/relayer wallet...');
        const adminKey = process.env.PRIVATE_KEY;
        if (!adminKey) {
            console.error('❌ No PRIVATE_KEY in .env to fund gas from. Please send 0.001 BNB to the EOA manually, then run this again.');
            process.exit(1);
        }
        const adminWallet = new ethers.Wallet(adminKey, provider);
        console.log(`   Admin wallet: ${adminWallet.address}, Balance: ${ethers.formatEther(await provider.getBalance(adminWallet.address))} BNB`);
        const fundTx = await adminWallet.sendTransaction({
            to: eoa,
            value: ethers.parseEther('0.001')
        });
        console.log(`   Sent 0.001 BNB (Tx: ${fundTx.hash}). Waiting...`);
        await fundTx.wait();
        console.log('   Funded ✅');
    }

    console.log(`\n📤 Transferring ${balance} USDC from EOA → SA...`);
    const tx = await usdc.transfer(saAddress, rawBal);
    console.log(`⏳ Tx submitted: ${tx.hash}`);
    await tx.wait();
    console.log(`✅ Transfer complete! The funds are now back in the SA.`);
}

const arg = process.argv[2];
if (!arg) {
    console.error('Usage: npx ts-node src/scripts/send-eoa-to-sa.ts <userId_or_wallet>');
    process.exit(1);
}

sendEoaToSa(arg).catch(e => {
    console.error('❌ Failed:', e.message);
    process.exit(1);
});
