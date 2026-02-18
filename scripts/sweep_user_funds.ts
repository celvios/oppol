
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
    const specificPrivyUserId = args[0];

    try {
        let walletsToScan: { userId: string, address: string, privyId?: string }[] = [];

        if (specificPrivyUserId) {
            console.log(`🔍 Targeting specific user: ${specificPrivyUserId}`);
            // 1. Get User
            const userResult = await query('SELECT id FROM users WHERE privy_user_id = $1', [specificPrivyUserId]);
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
            walletsToScan.push({
                userId,
                address: walletResult.rows[0].public_address,
                privyId: specificPrivyUserId
            });
        } else {
            console.log(`🌍 No user ID provided. Scanning ALL custodial wallets...`);
            const allWallets = await query(`
                SELECT w.user_id, w.public_address, u.privy_user_id 
                FROM wallets w
                JOIN users u ON w.user_id = u.id
            `);
            console.log(`📋 Found ${allWallets.rows.length} total wallets in DB.`);

            walletsToScan = allWallets.rows.map(row => ({
                userId: row.user_id,
                address: row.public_address,
                privyId: row.privy_user_id
            }));
        }

        // Setup Provider & Contract
        const rpcUrl = CONFIG.RPC_URL || process.env.RPC_URL || 'https://bsc-dataseed.binance.org';
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const USDC_ADDR = CONFIG.USDC_CONTRACT || process.env.NEXT_PUBLIC_USDC_CONTRACT;

        if (!USDC_ADDR) {
            console.error('❌ USDC Contract address not found in config.');
            process.exit(1);
        }

        const usdcAbi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
        const usdc = new ethers.Contract(USDC_ADDR, usdcAbi, provider);
        const decimals = await usdc.decimals();

        console.log(`Processing ${walletsToScan.length} wallets...`);
        let sweptCount = 0;
        let totalSwept = 0;

        // Process in chunks to avoid RPC rate limits
        const CHUNK_SIZE = 5;
        for (let i = 0; i < walletsToScan.length; i += CHUNK_SIZE) {
            const chunk = walletsToScan.slice(i, i + CHUNK_SIZE);

            await Promise.all(chunk.map(async (wallet) => {
                try {
                    // Check Balance
                    const balanceWei = await usdc.balanceOf(wallet.address);

                    // Threshold: 0.1 USDC (to avoid dust)
                    const minThreshold = ethers.parseUnits("0.1", decimals);

                    if (balanceWei > minThreshold) {
                        const balanceStr = ethers.formatUnits(balanceWei, decimals);
                        console.log(`💰 [Found] User ${wallet.privyId} (${wallet.address.slice(0, 6)}...): ${balanceStr} USDC`);

                        // Sweep
                        console.log(`   🚀 Sweeping...`);
                        const txHash = await processCustodialDeposit(wallet.userId, balanceStr, 'manual-sweep-all');
                        console.log(`   ✅ Swept! Tx: ${txHash}`);
                        sweptCount++;
                        totalSwept += parseFloat(balanceStr);
                    } else {
                        // console.log(`   . (Empty) ${wallet.address.slice(0,6)}...`);
                        process.stdout.write('.'); // progress dot
                    }
                } catch (err: any) {
                    console.error(`\n❌ Error processing user ${wallet.privyId}:`, err.message);
                }
            }));
        }

        console.log(`\n\n🏁 Done!`);
        console.log(`   Swept Wallets: ${sweptCount}`);
        console.log(`   Total Volume: ${totalSwept.toFixed(2)} USDC`);

    } catch (error: any) {
        console.error('❌ Error executing sweep:', error.message || error);
    } finally {
        process.exit(0);
    }
}


main();
