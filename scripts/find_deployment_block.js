const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
    const MARKET_ADDRESS = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MARKET_CONTRACT;
    const RPC_URL = process.env.BNB_RPC_URL || "https://bsc-dataseed.binance.org/";

    console.log(`🔍 Finding deployment block for ${MARKET_ADDRESS}...`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    const currentBlock = await provider.getBlockNumber();
    let low = 0;
    let high = currentBlock;
    let deployBlock = -1;

    console.log(`Current Block: ${currentBlock}`);

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const code = await provider.getCode(MARKET_ADDRESS, mid);

        if (code !== '0x') {
            // Contract exists at mid, so it was deployed at or before mid
            deployBlock = mid;
            high = mid - 1;
        } else {
            // Contract does not exist at mid, so it was deployed after mid
            low = mid + 1;
        }

        if (high - low < 1000) {
            process.stdout.write(`\rSearching... ${low} - ${high}`);
        }
    }

    console.log(`\n\n✅ Estimated Deployment Block: ${deployBlock}`);
    console.log(`   (Scanning from this block will cover full history)`);
}

main();
