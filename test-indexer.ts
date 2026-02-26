import { syncAllMarkets } from './src/services/marketIndexer';
import * as dotenv from 'dotenv';
dotenv.config();

async function testIndexer() {
    try {
        console.log("--- STARTING INDEXER ---");
        await syncAllMarkets();
        console.log("--- INDEXER FINISHED ---");
    } catch (e) {
        console.error("INDEXER ERROR:", e);
    } finally {
        process.exit(0);
    }
}
testIndexer();
