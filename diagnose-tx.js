require('dotenv').config({ path: '.env' });
const { ethers } = require('ethers');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const WALLET = '0x9Ff472aEb3A160A47E00916ce717802A511DE419';
const TX_HASH = '0x499c38f739482e85b8793f730c3e3605ac56360e754d09b3c160515c838364ab';

const MARKET_ABI = [
    'function userBalances(address) view returns (uint256)',
    'event Deposited(address indexed user, uint256 amount)',
    'event SharesPurchased(uint256 indexed marketId, address indexed user, uint256 outcomeIndex, uint256 shares, uint256 cost)',
];

async function diagnose() {
    const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-rpc.publicnode.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const MARKET_ADDR = process.env.MARKET_CONTRACT || process.env.NEXT_PUBLIC_MARKET_ADDRESS;

    console.log(`\n=== DIAGNOSE tx ${TX_HASH} ===\n`);
    console.log(`Google Wallet: ${WALLET}`);
    console.log(`Market Contract: ${MARKET_ADDR}\n`);

    // 1. Fetch the tx receipt and decode events
    const receipt = await provider.getTransactionReceipt(TX_HASH);
    if (!receipt) {
        console.error('❌ Transaction NOT FOUND on chain!');
    } else {
        console.log(`✅ Transaction found:`);
        console.log(`  Status: ${receipt.status === 1 ? '✅ SUCCESS' : '❌ REVERTED'}`);
        console.log(`  Block: ${receipt.blockNumber}`);
        console.log(`  From: ${receipt.from}`);
        console.log(`  To: ${receipt.to}`);
        console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
        console.log(`  Logs: ${receipt.logs.length} event(s)`);

        const iface = new ethers.Interface(MARKET_ABI);
        receipt.logs.forEach((log, i) => {
            try {
                const parsed = iface.parseLog(log);
                console.log(`\n  📋 Event[${i}]: ${parsed.name}`);
                parsed.args.forEach((arg, j) => {
                    const key = parsed.fragment.inputs[j]?.name || j.toString();
                    let val = arg.toString();
                    // Format big values
                    if (arg._isBigNumber || typeof arg === 'bigint') {
                        val = `${ethers.formatUnits(arg, 18)} (raw: ${arg.toString()})`;
                    }
                    console.log(`    ${key}: ${val}`);
                });
            } catch (e) {
                console.log(`  📋 Event[${i}]: (unknown event topic ${log.topics[0]?.slice(0, 10)})`);
            }
        });
    }

    // 2. Check current on-chain balance in contract
    const contract = new ethers.Contract(MARKET_ADDR, MARKET_ABI, provider);
    const balance = await contract.userBalances(WALLET);
    console.log(`\n=== CURRENT CONTRACT BALANCE ===`);
    console.log(`  ${WALLET}`);
    console.log(`  Balance: ${ethers.formatUnits(balance, 18)} USDC`);

    // 3. Check DB data for this wallet
    const dbCheck = await pool.query(
        `SELECT u.id, u.wallet_address, u.privy_user_id, w.public_address as eoa 
         FROM users u LEFT JOIN wallets w ON w.user_id = u.id 
         WHERE LOWER(u.wallet_address) = $1`,
        [WALLET.toLowerCase()]
    );

    console.log(`\n=== DATABASE USER RECORD ===`);
    if (dbCheck.rows.length === 0) {
        console.log('  ❌ No user found for this wallet address in users table!');
    } else {
        const u = dbCheck.rows[0];
        console.log(`  User ID: ${u.id}`);
        console.log(`  Wallet (SA): ${u.wallet_address}`);
        console.log(`  Privy ID: ${u.privy_user_id}`);
        console.log(`  EOA: ${u.eoa || 'NOT SET'}`);
    }

    // 4. Check trades in DB
    const trades = await pool.query(
        `SELECT * FROM trades WHERE LOWER(user_address) = $1 ORDER BY created_at DESC LIMIT 5`,
        [WALLET.toLowerCase()]
    );
    console.log(`\n=== DB TRADES FOR THIS WALLET ===`);
    console.log(`  Found: ${trades.rows.length} trades`);
    trades.rows.forEach(t => {
        console.log(`  [${t.created_at}] market=${t.market_id}, side=${t.side}, shares=${t.shares}, cost=${t.total_cost}, tx=${t.tx_hash}`);
    });

    await pool.end();
}

diagnose().catch(console.error);
