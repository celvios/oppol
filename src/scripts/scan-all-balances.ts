/**
 * Diagnostic: scan every address in the DB (wallet_address + wallets.public_address)
 * and report any with a meaningful balance in USDC, USDT, or the market contract.
 */
import dotenv from 'dotenv';
dotenv.config();

import { ethers } from 'ethers';
import { query } from '../config/database';

const RPC = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org';
const USDC = (process.env.NEXT_PUBLIC_USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d') as `0x${string}`;
const USDT = (process.env.NEXT_PUBLIC_USDT_CONTRACT || '0x55d398326f99059fF775485246999027B3197955') as `0x${string}`;
const MARKET = (process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MARKET_CONTRACT || '') as `0x${string}`;
const MIN_BAL = ethers.parseUnits('0.01', 18); // ignore dust below $0.01

async function bal(contract: ethers.Contract, addr: string): Promise<bigint> {
    try { return await contract.balanceOf(addr) as bigint; } catch { return 0n; }
}

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC);
    const erc20Abi = ['function balanceOf(address) view returns (uint256)'];
    const usdcC = new ethers.Contract(USDC, erc20Abi, provider);
    const usdtC = new ethers.Contract(USDT, erc20Abi, provider);
    const mktC = MARKET ? new ethers.Contract(MARKET, erc20Abi, provider) : null;

    const r = await query(`
        SELECT u.id,
               u.privy_user_id,
               u.wallet_address  AS db_addr,
               w.public_address  AS wallet_pub
        FROM users u
        LEFT JOIN wallets w ON w.user_id = u.id
        ORDER BY u.created_at ASC
    `);

    console.log(`\nScanning ${r.rows.length} users (all known addresses)…\n`);
    let found = 0;

    for (const row of r.rows) {
        // Collect every unique address we know for this user
        const addrs = [...new Set([row.db_addr, row.wallet_pub].filter(Boolean) as string[])];

        for (const addr of addrs) {
            const [usdcBal, usdtBal, mktBal] = await Promise.all([
                bal(usdcC, addr),
                bal(usdtC, addr),
                mktC ? bal(mktC, addr) : Promise.resolve(0n),
            ]);
            const total = usdcBal + usdtBal + mktBal;

            if (total > MIN_BAL) {
                found++;
                console.log('──────────────────────────────────────────────────');
                console.log(`User    : ${row.id}`);
                console.log(`Privy   : ${row.privy_user_id || '(none)'}`);
                console.log(`Address : ${addr}  ${addr === row.db_addr ? '(DB wallet_address)' : '(wallets.public_address)'}`);
                console.log(`USDC    : ${ethers.formatUnits(usdcBal, 18)}`);
                console.log(`USDT    : ${ethers.formatUnits(usdtBal, 18)}`);
                console.log(`Market  : ${ethers.formatUnits(mktBal, 18)}`);
                console.log(`TOTAL   : ${ethers.formatUnits(total, 18)}`);
                console.log();
            }
        }
    }

    if (found === 0) console.log('No addresses with balance > $0.01 found.');
    console.log(`\nDone. Found ${found} address(es) with meaningful balance.`);
    process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
