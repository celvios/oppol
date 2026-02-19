const { ethers } = require('ethers');
require('dotenv').config();

const RPC_URL = process.env.BNB_RPC_URL || 'https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/';
const TARGET_WALLET = '0x3B6a79d61523631473CF80d3845E9e6A0B11e5a4';
const USDC_ADDR = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const USDT_ADDR = '0x55d398326f99059fF775485246999027B3197955';

async function main() {
    console.log(`Scanning for deposits to ${TARGET_WALLET}...`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Scan last 5k blocks (~15 mins) to avoid RPC limits
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 5000;

    console.log(`Scanning blocks ${fromBlock} to ${currentBlock}`);

    // Event Signature: Transfer(address indexed from, address indexed to, uint256 value)
    // Topic0: 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
    // Topic2: Must be padded TARGET_WALLET
    const paddedAddress = ethers.zeroPadValue(TARGET_WALLET, 32);

    const filter = {
        topics: [
            '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', // Transfer
            null, // from (any)
            paddedAddress // to (TARGET)
        ],
        fromBlock,
        toBlock: currentBlock
    };

    try {
        const logs = await provider.getLogs(filter);
        console.log(`Found ${logs.length} transfer events.`);

        for (const log of logs) {
            let tokenName = 'UNKNOWN';
            let decimals = 18;

            if (log.address.toLowerCase() === USDC_ADDR.toLowerCase()) {
                tokenName = 'USDC';
                decimals = 18; // USDC on BSC is 18? Wait, usually 18 on BSC (unlike 6 on ETH)
            } else if (log.address.toLowerCase() === USDT_ADDR.toLowerCase()) {
                tokenName = 'USDT';
                decimals = 18;
            } else {
                continue; // Skip other tokens
            }

            const amount = ethers.formatUnits(log.data, decimals);
            console.log(`[${tokenName}] Received ${amount} | Tx: ${log.transactionHash}`);
        }

    } catch (e) {
        console.error("Scan Error:", e.message);
    }
}

main();
