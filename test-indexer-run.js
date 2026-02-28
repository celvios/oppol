require('dotenv').config({ path: '.env' });
const { syncAllMarkets } = require('./dist/services/marketIndexer.js');

async function debugIndexer() {
    console.log('Starting standalone indexer debug...');
    await syncAllMarkets();
    console.log('Done!');
    process.exit(0);
}
debugIndexer();
