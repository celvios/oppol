
import { query } from '../src/config/database';
import { processCustodialDeposit } from '../src/controllers/walletController';
import { ethers } from 'ethers';
import { CONFIG } from '../src/config/contracts';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
    const args = process.argv.slice(2);
    const privyUserId = args[0];

    if (!privyUserId) {
        console.error('Usage: ts-node scripts/sweep_user_funds.ts <privy_user_id>');
        process.exit(1);
    }

    console.log(`🔍 Checking wallet for user: ${privyUserId}`);

    try {
        // 1. Get User
        const userResult = await query('SELECT id FROM users WHERE privy_user_id = $1', [privyUserId]);
        if (userResult.rows.length === 0) {
            console.error('❌ User not found in database.');
            process.exit(1);
        }
        const userId = userResult.rows[0].id;

        // 2. Get Wallet
        const walletResult = await query('SELECT public_address FROM wallets WHERE user_id = $1', [userId]);
        if (walletResult.rows.length === 0) {
            console.error('❌ No custodial wallet found for this user.');
            process.exit(1);
        }
        const custodialAddress = walletResult.rows[0].public_address;
        console.log(`✅ Found Custodial Address: ${custodialAddress}`);

        // 3. Check On-Chain Balance
        const rpcUrl = CONFIG.RPC_URL || process.env.RPC_URL || 'https://bsc-dataseed.binance.org';
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const USDC_ADDR = CONFIG.USDC_CONTRACT || process.env.NEXT_PUBLIC_USDC_CONTRACT;

        if (!USDC_ADDR) {
            console.error('❌ USDC Contract address not found in config.');
            process.exit(1);
        }

        const usdcAbi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
        const usdc = new ethers.Contract(USDC_ADDR, usdcAbi, provider);

        const balanceWei = await usdc.balanceOf(custodialAddress);
        const decimals = await usdc.decimals();
        const balanceStr = ethers.formatUnits(balanceWei, decimals);

        console.log(`💰 Current Wallet Balance: ${balanceStr} USDC`);

        if (balanceWei === 0n) {
            console.log('⚠️ Wallet is empty. No funds to sweep.');
            process.exit(0);
        }

        // 4. Sweep Funds
        console.log(`🚀 Initiating sweep of ${balanceStr} USDC...`);
        const txHash = await processCustodialDeposit(userId, balanceStr, 'manual-admin-sweep');

        console.log(`✅ Success! Funds swept to game contract.`);
        console.log(`🔗 Tx Hash: ${txHash}`);

    } catch (error: any) {
        console.error('❌ Error executing sweep:', error.message || error);
    } finally {
        // Force exit to close DB pool
        process.exit(0);
    }
}

main();
