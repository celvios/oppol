import { query } from './src/config/database';
import { syncAllMarkets } from './src/services/marketIndexer';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
dotenv.config();

async function resetAndIndex() {
    try {
        console.log("--- GETTING CURRENT BLOCK ---");
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || process.env.BNB_RPC_URL);
        const currentBlock = await provider.getBlockNumber();
        const resetBlock = currentBlock - 5000; // ~4 hours ago

        console.log(`Current block: ${currentBlock}, Resetting to: ${resetBlock}`);

        await query('UPDATE markets SET last_indexed_block = $1', [resetBlock]);

        console.log("--- STARTING INDEXER ---");
        await syncAllMarkets();

        console.log("--- RECENT TRADES ---");
        const trades = await query('SELECT * FROM trades ORDER BY created_at DESC LIMIT 5');
        console.log(trades.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
resetAndIndex();
