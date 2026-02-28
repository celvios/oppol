require('dotenv').config({ path: '.env' });
const { ethers } = require('ethers');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const MARKET_ABI = [
    "function marketCount() view returns (uint256)",
    "event SharesPurchased(uint256 indexed marketId, address indexed user, uint256 outcomeIndex, uint256 shares, uint256 cost)"
];

async function backfill() {
    const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-rpc.publicnode.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const MARKET_ADDR = process.env.MARKET_CONTRACT || process.env.NEXT_PUBLIC_MARKET_ADDRESS;

    if (!MARKET_ADDR) {
        console.error('MARKET_ADDR not configured!');
        process.exit(1);
    }

    console.log(`[Backfill] Market: ${MARKET_ADDR}`);

    // Ensure tx_hash unique constraint exists
    try {
        await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_tx_hash ON trades (tx_hash) WHERE tx_hash IS NOT NULL');
        console.log('[Backfill] ✅ tx_hash unique index ensured');
    } catch (e) {
        console.log('[Backfill] tx_hash index check skipped:', e.message);
    }

    const contract = new ethers.Contract(MARKET_ADDR, MARKET_ABI, provider);
    const currentBlock = await provider.getBlockNumber();

    // Scan 50,000 blocks (~50 hours at 3s/block)
    const scanStart = Math.max(0, currentBlock - 50000);
    const CHUNK_SIZE = 1000;

    console.log(`[Backfill] Scanning from block ${scanStart} to ${currentBlock} (${currentBlock - scanStart} blocks)...`);

    let totalFound = 0;
    let totalInserted = 0;

    for (let from = scanStart; from <= currentBlock; from += CHUNK_SIZE) {
        const to = Math.min(from + CHUNK_SIZE - 1, currentBlock);
        try {
            const logs = await contract.queryFilter(contract.filters.SharesPurchased(), from, to);
            if (logs.length > 0) {
                console.log(`[Backfill] Block ${from}-${to}: Found ${logs.length} trades`);
                totalFound += logs.length;
                for (const log of logs) {
                    const [marketId, user, outcomeIndex, shares, cost] = log.args;
                    const txHash = log.transactionHash;
                    const sharesFormatted = ethers.formatUnits(shares, 18);
                    const costFormatted = ethers.formatUnits(cost, 18);
                    const pricePerShare = Number(sharesFormatted) > 0 ? (Number(costFormatted) / Number(sharesFormatted)).toFixed(6) : '0';
                    const sideStr = Number(outcomeIndex) === 0 ? 'YES' : 'NO';

                    try {
                        const result = await pool.query(`
                            INSERT INTO trades (
                                market_id, user_address, outcome_index, side, shares, total_cost, price_per_share, tx_hash, created_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                            ON CONFLICT DO NOTHING
                        `, [Number(marketId), user, Number(outcomeIndex), sideStr, sharesFormatted, costFormatted, pricePerShare, txHash]);

                        if (result.rowCount > 0) {
                            totalInserted++;
                            console.log(`  ✅ Inserted trade: market=${marketId}, user=${user}, side=${sideStr}, cost=${costFormatted}, tx=${txHash.slice(0, 10)}...`);
                        }
                    } catch (dbErr) {
                        console.error(`  ❌ DB insert error for ${txHash}:`, dbErr.message);
                    }
                }
            }
        } catch (rpcErr) {
            console.warn(`[Backfill] Chunk ${from}-${to} failed: ${rpcErr.message}`);
        }
        await new Promise(r => setTimeout(r, 100)); // Rate limit
    }

    console.log(`\n[Backfill] Complete! Found: ${totalFound} trades, Inserted: ${totalInserted} new trades`);
    await pool.end();
}

backfill().catch(console.error);
