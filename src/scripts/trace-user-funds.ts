/**
 * Trace funds for two specific users:
 * 1. 0xBe7db7c... (user 5da55cd9) — $60 deposited but EOA shows $0
 * 2. 0x0ff7e81... — 8.74 USDT sitting at EOA, not in DB
 *
 * For each: derive old Simple SA + new Safe SA, check balances at every known address.
 */
import dotenv from 'dotenv';
dotenv.config();

import { ethers } from 'ethers';
import {
    createPublicClient, http, keccak256, toBytes, type PublicClient
} from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { toSimpleSmartAccount, toSafeSmartAccount } from 'permissionless/accounts';
import { entryPoint07Address } from 'viem/account-abstraction';
import { query } from '../config/database';
import { EncryptionService } from '../services/encryption';

const RPC = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org';
const USDC = process.env.NEXT_PUBLIC_USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const USDT = process.env.NEXT_PUBLIC_USDT_CONTRACT || '0x55d398326f99059fF775485246999027B3197955';
const MARKET = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MARKET_CONTRACT || '';

async function checkAddr(addr: string, usdc: ethers.Contract, usdt: ethers.Contract, mkt: ethers.Contract | null) {
    const [u, t, m] = await Promise.all([
        usdc.balanceOf(addr).catch(() => 0n),
        usdt.balanceOf(addr).catch(() => 0n),
        mkt ? mkt.balanceOf(addr).catch(() => 0n) : Promise.resolve(0n),
    ]);
    return { usdcBal: u as bigint, usdtBal: t as bigint, mktBal: m as bigint, total: (u as bigint) + (t as bigint) + (m as bigint) };
}

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC);
    const publicClient = createPublicClient({ chain: bsc, transport: http(RPC) }) as PublicClient;
    const erc20Abi = ['function balanceOf(address) view returns (uint256)'];
    const usdcC = new ethers.Contract(USDC, erc20Abi, provider);
    const usdtC = new ethers.Contract(USDT, erc20Abi, provider);
    const mktC = MARKET ? new ethers.Contract(MARKET, erc20Abi, provider) : null;

    // ── User 1: 0xBe7db7... registered as 5da55cd9 ────────────────────────────
    console.log('\n=== USER 1: 0xBe7db7c2a7c6f911C65F0335C893E58Cb34590e3 ===\n');

    const r = await query(
        `SELECT u.id, u.wallet_address, u.privy_user_id, w.encrypted_private_key, w.public_address
         FROM users u
         LEFT JOIN wallets w ON w.user_id = u.id
         WHERE LOWER(u.wallet_address) = $1`,
        ['0xbe7db7c2a7c6f911c65f0335c893e58cb34590e3'],
    );

    if (r.rows.length === 0) {
        console.log('Not found in DB.');
    } else {
        for (const user of r.rows) {
            console.log('DB user id     :', user.id);
            console.log('DB wallet_addr :', user.wallet_address);
            console.log('DB pub_addr    :', user.public_address);

            // Check raw EOA
            const eoa = await checkAddr(user.wallet_address, usdcC, usdtC, mktC);
            console.log(`\nEOA (${user.wallet_address}):`);
            console.log(`  USDC: ${ethers.formatUnits(eoa.usdcBal, 18)} | USDT: ${ethers.formatUnits(eoa.usdtBal, 18)} | Market: ${ethers.formatUnits(eoa.mktBal, 18)}`);

            if (user.public_address) {
                const pub = await checkAddr(user.public_address, usdcC, usdtC, mktC);
                console.log(`\nwallet.public_address (${user.public_address}):`);
                console.log(`  USDC: ${ethers.formatUnits(pub.usdcBal, 18)} | USDT: ${ethers.formatUnits(pub.usdtBal, 18)} | Market: ${ethers.formatUnits(pub.mktBal, 18)}`);
            }

            if (user.encrypted_private_key) {
                try {
                    const pk = EncryptionService.decrypt(user.encrypted_private_key);
                    const key = (pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`;
                    const owner = privateKeyToAccount(key);
                    console.log('\nEOA from key  :', owner.address);

                    const saltNonce = BigInt('0x' + keccak256(toBytes(user.id)).slice(2, 18));
                    const [simpleSA, safeSA] = await Promise.all([
                        toSimpleSmartAccount({ client: publicClient as any, owner, entryPoint: { address: entryPoint07Address, version: '0.7' } }).then(a => a.address),
                        toSafeSmartAccount({ client: publicClient as any, owners: [owner], version: '1.4.1', entryPoint: { address: entryPoint07Address, version: '0.7' }, saltNonce }).then(a => a.address),
                    ]);

                    const simBal = await checkAddr(simpleSA, usdcC, usdtC, mktC);
                    const safBal = await checkAddr(safeSA, usdcC, usdtC, mktC);

                    console.log(`\nSimple SA (${simpleSA}):`);
                    console.log(`  USDC: ${ethers.formatUnits(simBal.usdcBal, 18)} | USDT: ${ethers.formatUnits(simBal.usdtBal, 18)} | Market: ${ethers.formatUnits(simBal.mktBal, 18)} | TOTAL: ${ethers.formatUnits(simBal.total, 18)}`);
                    console.log(`\nSafe SA (${safeSA}):`);
                    console.log(`  USDC: ${ethers.formatUnits(safBal.usdcBal, 18)} | USDT: ${ethers.formatUnits(safBal.usdtBal, 18)} | Market: ${ethers.formatUnits(safBal.mktBal, 18)} | TOTAL: ${ethers.formatUnits(safBal.total, 18)}`);
                } catch (e: any) {
                    console.log('Key derivation failed:', e.message);
                }
            } else {
                console.log('\nNo custodial key — MetaMask user.');
            }
        }
    }

    // ── User 2: 0x0ff7e81... — not in DB ──────────────────────────────────────
    console.log('\n\n=== USER 2: 0x0ff7e81Cb052243ECf72d19D63e0d4268fa26eC9 ===\n');
    const addr2 = '0x0ff7e81Cb052243ECf72d19D63e0d4268fa26eC9';

    const r2 = await query(
        `SELECT u.id, u.wallet_address, u.privy_user_id, w.encrypted_private_key, w.public_address
         FROM users u
         LEFT JOIN wallets w ON w.user_id = u.id
         WHERE LOWER(u.wallet_address) = $1
            OR LOWER(w.public_address) = $1`,
        [addr2.toLowerCase()],
    );

    if (r2.rows.length === 0) {
        console.log('NOT in DB. Checking balance at raw address:');
        const b = await checkAddr(addr2, usdcC, usdtC, mktC);
        console.log(`  USDC: ${ethers.formatUnits(b.usdcBal, 18)} | USDT: ${ethers.formatUnits(b.usdtBal, 18)} | Market: ${ethers.formatUnits(b.mktBal, 18)}`);
        console.log('\n→ This is a MetaMask/EOA user. Funds are in their own wallet.');
        console.log('→ They can connect their wallet to withdraw/use the USDT.');
        console.log('→ If they sent USDT expecting it to go into the game, they need to re-deposit via the deposit page.');
    } else {
        for (const user of r2.rows) {
            console.log('Found in DB! user id:', user.id);
            // same derivation as above...
        }
    }

    process.exit(0);
}
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
