import dotenv from 'dotenv';
dotenv.config();
import { ethers } from 'ethers';
import { query } from '../config/database';

const RPC = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org';
const USDC = process.env.NEXT_PUBLIC_USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const USDT = process.env.NEXT_PUBLIC_USDT_CONTRACT || '0x55d398326f99059fF775485246999027B3197955';
const MARKET = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MARKET_CONTRACT || '';

const CHECK = [
    '0xBe7db7c2a7c6f911C65F0335C893E58Cb34590e3',
    '0x0ff7e81Cb052243ECf72d19D63e0d4268fa26eC9',
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC);
    const abi = ['function balanceOf(address) view returns (uint256)'];
    const usdc = new ethers.Contract(USDC, abi, provider);
    const usdt = new ethers.Contract(USDT, abi, provider);
    const mkt = MARKET ? new ethers.Contract(MARKET, abi, provider) : null;

    console.log('\n=== ON-CHAIN BALANCE CHECK ===\n');

    for (const addr of CHECK) {
        const [usdcBal, usdtBal, mktBal] = await Promise.all([
            usdc.balanceOf(addr).catch(() => 0n),
            usdt.balanceOf(addr).catch(() => 0n),
            mkt ? mkt.balanceOf(addr).catch(() => 0n) : Promise.resolve(0n),
        ]);
        console.log(`Address : ${addr}`);
        console.log(`  USDC wallet : ${ethers.formatUnits(usdcBal, 18)}`);
        console.log(`  USDT wallet : ${ethers.formatUnits(usdtBal, 18)}`);
        console.log(`  Market bal  : ${ethers.formatUnits(mktBal, 18)}`);
        console.log(`  TOTAL       : ${ethers.formatUnits(usdcBal + usdtBal + mktBal, 18)}`);
        console.log();

        // Also check DB — is this address registered?
        try {
            const r = await query(
                `SELECT id, privy_user_id, wallet_address FROM users
                 WHERE LOWER(wallet_address) = $1
                    OR id IN (SELECT user_id FROM wallets WHERE LOWER(public_address) = $1)`,
                [addr.toLowerCase()],
            );
            if (r.rows.length > 0) {
                for (const u of r.rows) {
                    console.log(`  DB match    : user ${u.id} | privy: ${u.privy_user_id} | db_wallet: ${u.wallet_address}`);
                }
            } else {
                console.log(`  DB match    : NOT FOUND in users table`);
            }

            // Check trades
            const t = await query(
                `SELECT COUNT(*) as cnt, SUM(total_cost) as vol FROM trades WHERE LOWER(user_address) = $1`,
                [addr.toLowerCase()],
            );
            console.log(`  Trades in DB: ${t.rows[0].cnt} trade(s), volume: $${parseFloat(t.rows[0].vol || '0').toFixed(4)}`);
        } catch (e: any) {
            console.log(`  DB lookup failed: ${e.message}`);
        }
        console.log('─'.repeat(60));
    }
    process.exit(0);
}
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
