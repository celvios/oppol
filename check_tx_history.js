const { ethers } = require('ethers');
require('dotenv').config();

// QuickNode or Binance RPC
const RPC_URL = process.env.BNB_RPC_URL || 'https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/';
const TARGET_WALLET = '0x3B6a79d61523631473CF80d3845E9e6A0B11e5a4';

async function main() {
    console.log(`Checking history for ${TARGET_WALLET} on BSC...`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    try {
        // Get current block
        const currentBlock = await provider.getBlockNumber();
        console.log(`Current Block: ${currentBlock}`);

        // Scan last 10,000 blocks for ANY activity (approx 8 hours)
        // Note: RPCs often limit range. strict event filtering is better for tokens.
        // For native BNB transfers, standard RPCs don't give "history" easily without indexing.
        // We will check the NONCE. If nonce > 0, it has sent outgoing txs.

        const nonce = await provider.getTransactionCount(TARGET_WALLET);
        console.log(`Nonce (Outgoing Txs): ${nonce}`);

        const balance = await provider.getBalance(TARGET_WALLET);
        console.log(`Current BNB: ${ethers.formatEther(balance)}`);

        if (nonce === 0 && balance === 0n) {
            console.log("Wallet appears unused (No outgoing txs, 0 BNB).");
        } else {
            console.log("Wallet has been used.");
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

main();
